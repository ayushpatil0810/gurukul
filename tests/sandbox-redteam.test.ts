import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, describe, expect, it } from "vitest";

import { DockerSandboxRunner } from "@/sandbox/docker-runner";
import type { RunLimits, RunOutcome, SubmissionLanguage } from "@/sandbox/types";

const exec = promisify(execFile);
const runner = new DockerSandboxRunner();
const CANARY = `PORTAL_HOST_CANARY_${randomBytes(8).toString("hex")}`;
const SENTINEL = "HARNESS_SENTINEL_7f3a9c";

let canaryFile = "";

type HostileCase = {
  name: string;
  language: SubmissionLanguage;
  code: string;
  outcomes: readonly RunOutcome[];
  limits?: Partial<RunLimits>;
};

const loopLimits = { cpuSeconds: 2, wallSeconds: 6 };
const quickLimits = { wallSeconds: 6 };

const cases: HostileCase[] = [
  {
    name: "infinite loop",
    language: "javascript",
    code: "while (true) {}",
    outcomes: ["timeout"],
    limits: loopLimits,
  },
  {
    name: "fork bomb",
    language: "javascript",
    code: "const {spawn}=require('child_process'); const kids=[]; function launch(){ return new Promise((resolve)=>{ const child=spawn('/bin/sleep',['30']); child.once('spawn',()=>resolve(child)); child.once('error',(e)=>resolve(e)); }); } (async()=>{ for(;;){ const result=await launch(); if(result instanceof Error){ console.error(result.message); for (const kid of kids) kid.kill('SIGKILL'); process.exit(1);} kids.push(result);} })();",
    outcomes: ["blocked_operation"],
    limits: quickLimits,
  },
  {
    name: "memory bomb",
    language: "javascript",
    code: "const a=[]; while(true) a.push(Buffer.alloc(8*1024*1024,1));",
    outcomes: ["memory_limit"],
    limits: { cpuSeconds: 15, wallSeconds: 20 },
  },
  {
    name: "read host files",
    language: "javascript",
    code: "const fs=require('fs'); let o=''; for (const p of ['/etc/passwd','/etc/shadow','/proc/1/root/etc/passwd']) { try { o+=fs.readFileSync(p,'utf8'); } catch (e) { o+=String(e.message)+'\\n'; } } process.stdout.write(o);",
    outcomes: ["ok", "runtime_error", "blocked_operation"],
    limits: quickLimits,
  },
  {
    name: "write outside scratch",
    language: "javascript",
    code: "require('fs').writeFileSync('/etc/portal-escape','x');",
    outcomes: ["blocked_operation"],
    limits: quickLimits,
  },
  {
    name: "outbound network",
    language: "javascript",
    code: "require('net').connect(80,'1.2.3.4').on('error',(e)=>{console.error(e.message); process.exit(1);});",
    outcomes: ["blocked_operation"],
    limits: quickLimits,
  },
  {
    name: "dns lookup",
    language: "javascript",
    code: "require('dns').lookup('example.com',(e)=>{console.error(e&&e.message); process.exit(1);});",
    outcomes: ["blocked_operation"],
    limits: quickLimits,
  },
  {
    name: "listen on a port",
    language: "javascript",
    code: "require('net').createServer().listen(8080,'0.0.0.0',()=>process.exit(0)).on('error',(e)=>{console.error(e.message); process.exit(1);});",
    outcomes: ["blocked_operation"],
    limits: quickLimits,
  },
  {
    name: "excessive output",
    language: "javascript",
    code: "while(true) process.stdout.write('x'.repeat(4096));",
    outcomes: ["output_limit"],
    limits: quickLimits,
  },
  {
    name: "symlink traversal",
    language: "javascript",
    code: "const fs=require('fs'); fs.symlinkSync('/etc/passwd','/sandbox/link'); process.stdout.write(fs.readFileSync('/sandbox/link','utf8')); process.stdout.write(fs.readFileSync('/sandbox/../../etc/passwd','utf8'));",
    outcomes: ["ok", "runtime_error", "blocked_operation"],
    limits: quickLimits,
  },
  {
    name: "read the harness",
    language: "javascript",
    code: "const fs=require('fs'); let o=Object.keys(process.env).join(',')+'\\n'; for (const p of ['/opt/expected','/sandbox/expected','/tmp/harness']) { try { o+=fs.readFileSync(p,'utf8'); } catch (e) { o+=e.message+'\\n'; } } process.stdout.write(o);",
    outcomes: ["ok", "runtime_error"],
    limits: quickLimits,
  },
  {
    name: "infinite loop",
    language: "cpp",
    code: "int main(){for(;;){}}",
    outcomes: ["timeout"],
    limits: loopLimits,
  },
  {
    name: "fork bomb",
    language: "cpp",
    code: "#include <cerrno>\n#include <cstring>\n#include <iostream>\n#include <unistd.h>\nint main(){for(;;){ if(fork()<0){ std::cerr<<std::strerror(errno); return 1; } }}\n",
    outcomes: ["blocked_operation"],
    limits: quickLimits,
  },
  {
    name: "memory bomb",
    language: "cpp",
    code: "#include <vector>\nint main(){std::vector<char*> p; for(;;) p.push_back(new char[1<<24]);}\n",
    outcomes: ["memory_limit"],
    limits: quickLimits,
  },
  {
    name: "read host files",
    language: "cpp",
    code: "#include <fstream>\n#include <iostream>\n#include <string>\nint main(){const char* paths[]={\"/etc/passwd\",\"/etc/shadow\",\"/proc/1/root/etc/passwd\"}; for(auto p: paths){std::ifstream in(p); std::cout<<std::string((std::istreambuf_iterator<char>(in)),{});}}\n",
    outcomes: ["ok", "runtime_error", "blocked_operation"],
    limits: quickLimits,
  },
  {
    name: "write outside scratch",
    language: "cpp",
    code: "#include <cerrno>\n#include <cstring>\n#include <fstream>\n#include <iostream>\nint main(){std::ofstream o(\"/etc/portal-escape\"); o<<\"x\"; o.flush(); if(!o){std::cerr<<std::strerror(errno); return 1;}}\n",
    outcomes: ["blocked_operation"],
    limits: quickLimits,
  },
  {
    name: "outbound network",
    language: "cpp",
    code: "#include <arpa/inet.h>\n#include <cstring>\n#include <iostream>\n#include <netinet/in.h>\n#include <sys/socket.h>\nint main(){int s=socket(AF_INET,SOCK_STREAM,0); sockaddr_in a{}; a.sin_family=AF_INET; a.sin_port=htons(80); inet_pton(AF_INET,\"1.2.3.4\",&a.sin_addr); if(connect(s,(sockaddr*)&a,sizeof(a))!=0){std::cerr<<std::strerror(errno); return 1;}}\n",
    outcomes: ["blocked_operation"],
    limits: quickLimits,
  },
  {
    name: "dns lookup",
    language: "cpp",
    code: "#include <iostream>\n#include <netdb.h>\nint main(){addrinfo* r=nullptr; int e=getaddrinfo(\"example.com\",\"80\",nullptr,&r); if(e){std::cerr<<gai_strerror(e); return 1;}}\n",
    outcomes: ["blocked_operation"],
    limits: quickLimits,
  },
  {
    name: "listen on a port",
    language: "cpp",
    code: "#include <cstring>\n#include <iostream>\n#include <netinet/in.h>\n#include <sys/socket.h>\nint main(){int s=socket(AF_INET,SOCK_STREAM,0); sockaddr_in a{}; a.sin_family=AF_INET; a.sin_port=htons(8080); a.sin_addr.s_addr=htonl(INADDR_ANY); if(bind(s,(sockaddr*)&a,sizeof(a))!=0){std::cerr<<std::strerror(errno); return 1;} if(listen(s,1)!=0){std::cerr<<std::strerror(errno); return 1;}}\n",
    outcomes: ["blocked_operation"],
    limits: quickLimits,
  },
  {
    name: "excessive output",
    language: "cpp",
    code: "#include <iostream>\n#include <string>\nint main(){std::string s(4096,'x'); while(true) std::cout<<s;}\n",
    outcomes: ["output_limit"],
    limits: quickLimits,
  },
  {
    name: "symlink traversal",
    language: "cpp",
    code: "#include <fstream>\n#include <iostream>\n#include <string>\n#include <unistd.h>\nint main(){symlink(\"/etc/passwd\",\"/sandbox/link\"); std::ifstream in(\"/sandbox/link\"); std::cout<<std::string((std::istreambuf_iterator<char>(in)),{}); std::ifstream in2(\"/sandbox/../../etc/passwd\"); std::cout<<std::string((std::istreambuf_iterator<char>(in2)),{});}\n",
    outcomes: ["ok", "runtime_error", "blocked_operation"],
    limits: quickLimits,
  },
  {
    name: "read the harness",
    language: "cpp",
    code: "#include <cstdlib>\n#include <fstream>\n#include <iostream>\n#include <string>\nint main(){const char* paths[]={\"/opt/expected\",\"/sandbox/expected\",\"/tmp/harness\"}; for(auto p: paths){std::ifstream in(p); std::cout<<std::string((std::istreambuf_iterator<char>(in)),{})<<\"\\n\";} if(const char* e=getenv(\"PORTAL_EXPECTED\")) std::cout<<e;}\n",
    outcomes: ["ok", "runtime_error"],
    limits: quickLimits,
  },
  {
    name: "infinite loop",
    language: "java",
    code: "public class Main { public static void main(String[] args) { for(;;) {} } }\n",
    outcomes: ["timeout"],
    limits: loopLimits,
  },
  {
    name: "fork bomb",
    language: "java",
    code: "public class Main { public static void main(String[] args) throws Exception { while(true) new ProcessBuilder(\"/bin/sh\",\"-c\",\"sleep 30\").start(); } }\n",
    outcomes: ["blocked_operation"],
    limits: quickLimits,
  },
  {
    name: "memory bomb",
    language: "java",
    code: "public class Main { public static void main(String[] args) { var a=new java.util.ArrayList<byte[]>(); while(true) a.add(new byte[32*1024*1024]); } }\n",
    outcomes: ["memory_limit"],
    limits: quickLimits,
  },
  {
    name: "read host files",
    language: "java",
    code: "public class Main { public static void main(String[] args) throws Exception { for (String p : new String[]{\"/etc/passwd\",\"/etc/shadow\",\"/proc/1/root/etc/passwd\"}) { try { System.out.print(java.nio.file.Files.readString(java.nio.file.Path.of(p))); } catch (Exception e) { System.out.println(e); } } } }\n",
    outcomes: ["ok", "runtime_error", "blocked_operation"],
    limits: quickLimits,
  },
  {
    name: "write outside scratch",
    language: "java",
    code: "public class Main { public static void main(String[] args) throws Exception { java.nio.file.Files.writeString(java.nio.file.Path.of(\"/etc/portal-escape\"), \"x\"); } }\n",
    outcomes: ["blocked_operation"],
    limits: quickLimits,
  },
  {
    name: "outbound network",
    language: "java",
    code: "public class Main { public static void main(String[] args) throws Exception { try (var s = new java.net.Socket(\"1.2.3.4\", 80)) {} } }\n",
    outcomes: ["blocked_operation"],
    limits: quickLimits,
  },
  {
    name: "dns lookup",
    language: "java",
    code: "public class Main { public static void main(String[] args) throws Exception { java.net.InetAddress.getByName(\"example.com\"); } }\n",
    outcomes: ["blocked_operation"],
    limits: quickLimits,
  },
  {
    name: "listen on a port",
    language: "java",
    code: "public class Main { public static void main(String[] args) throws Exception { try (var s = new java.net.ServerSocket(8080)) {} } }\n",
    outcomes: ["blocked_operation"],
    limits: quickLimits,
  },
  {
    name: "excessive output",
    language: "java",
    code: "public class Main { public static void main(String[] args) { while(true) System.out.print(\"x\".repeat(4096)); } }\n",
    outcomes: ["output_limit"],
    limits: quickLimits,
  },
  {
    name: "symlink traversal",
    language: "java",
    code: "public class Main { public static void main(String[] args) throws Exception { var link=java.nio.file.Path.of(\"/sandbox/link\"); java.nio.file.Files.createSymbolicLink(link, java.nio.file.Path.of(\"/etc/passwd\")); System.out.print(java.nio.file.Files.readString(link)); System.out.print(java.nio.file.Files.readString(java.nio.file.Path.of(\"/sandbox/../etc/passwd\"))); } }\n",
    outcomes: ["ok", "runtime_error", "blocked_operation"],
    limits: quickLimits,
  },
  {
    name: "read the harness",
    language: "java",
    code: "public class Main { public static void main(String[] args) { for (String p : new String[]{\"/opt/expected\",\"/sandbox/expected\",\"/tmp/harness\"}) { try { System.out.print(java.nio.file.Files.readString(java.nio.file.Path.of(p))); } catch (Exception e) { System.out.println(e.getMessage()); } } System.out.print(String.valueOf(System.getenv(\"PORTAL_EXPECTED\"))); } }\n",
    outcomes: ["ok", "runtime_error"],
    limits: quickLimits,
  },
];

describe("sandbox red team", () => {
  afterAll(async () => {
    if (canaryFile) {
      const still = await readFile(canaryFile, "utf8");
      expect(still).toBe(CANARY);
      await rm(path.dirname(canaryFile), { recursive: true, force: true });
    }
    const listed = await exec("docker", ["ps", "-aq", "--filter", "name=portal-sbx-"]);
    expect(listed.stdout.trim()).toBe("");
  });

  it("keeps a host-only canary out of every run", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "portal-canary-"));
    canaryFile = path.join(dir, "canary.txt");
    await writeFile(canaryFile, CANARY, "utf8");

    const failures: string[] = [];
    for (const item of cases) {
      const result = await runner.run(item.language, item.code, "", item.limits);
      const blob = `${result.stdout}\n${result.stderr}`;
      const problems: string[] = [];
      if (!item.outcomes.includes(result.outcome)) {
        problems.push(`outcome ${result.outcome} exit=${result.exitCode} stderr=${result.stderr.slice(0, 400)}`);
      }
      if (blob.includes(CANARY)) problems.push("host canary leaked");
      if (blob.includes(SENTINEL)) problems.push("harness sentinel leaked");
      if (problems.length > 0) {
        failures.push(`${item.language} ${item.name}: ${problems.join("; ")}`);
      }
    }

    expect(failures).toEqual([]);
  }, 300_000);

  it("finishes a benign program while a loop is still bounded", async () => {
    const started = Date.now();
    const hostile = runner.run("javascript", "while (true) {}", "", {
      cpuSeconds: 3,
      wallSeconds: 8,
    });
    const benign = await runner.run("javascript", "process.stdout.write('ok\\n')", "");
    expect(benign.outcome).toBe("ok");
    expect(benign.stdout).toContain("ok");
    expect(Date.now() - started).toBeLessThan(5000);
    const bounded = await hostile;
    expect(bounded.outcome).toBe("timeout");
  }, 60_000);
});
