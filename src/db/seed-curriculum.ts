export interface SeedLessonInput {
  moduleTitle: string;
  titleEn: string;
  titleHi: string;
  contentEn: string;
  contentHi: string;
  practicalExample: string;
  diagramSpec: string;
  exercisesText: string;
  revisionSummary: string;
  quizJson: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

export interface SeedCourseInput {
  slug: string;
  stage: number;
  stageTitle: string;
  subjectArea: string;
  adaptiveLevel: string;
  titleEn: string;
  titleHi: string;
  summaryEn: string;
  summaryHi: string;
  difficulty: string;
  prerequisiteSlug: string | null;
  prerequisitesJson: string[];
  learningObjectivesJson: string[];
  referencesJson: Array<{ title: string; url: string; source: string }>;
  caseStudyText: string;
  projectBrief: string;
  estimatedMinutes: number;
  orderIndex: number;
  lessons: SeedLessonInput[];
}

export const CURRICULUM_COURSES: SeedCourseInput[] = [
  {
    slug: 'stage-1-computer-fundamentals',
    stage: 1,
    stageTitle: 'Stage 1: Computer Fundamentals & Architecture',
    subjectArea: 'Computer Science Foundations',
    adaptiveLevel: 'Absolute Beginner',
    titleEn: 'Computer Architecture, Binary Logic & Memory Layout',
    titleHi: 'कंप्यूटर आर्किटेक्चर, बाइनरी लॉजिक और मेमोरी लेआउट',
    summaryEn: 'Boolean logic, CPU execution cycles, virtual memory paging, endianness, and storage file systems.',
    summaryHi: 'बूलियन लॉजिक, सीपीयू चक्र, वर्चुअल मेमोरी पेजिंग और फाइल सिस्टम को समझें।',
    difficulty: 'Beginner',
    prerequisiteSlug: null,
    prerequisitesJson: [],
    learningObjectivesJson: [
      'Convert fluently between binary, hexadecimal, and decimal representations',
      'Explain little-endian byte ordering in x86_64 memory dumps',
      'Distinguish stack frames, heap allocations, and virtual page tables',
    ],
    referencesJson: [
      { title: 'Operating Systems: Three Easy Pieces', url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/', source: 'OSTEP' },
    ],
    caseStudyText: 'Case Study: Diagnosing an endianness bug in an embedded telemetry parser where 16-bit sensor ports were misread.',
    projectBrief: 'Mini-Project: Write a Python script to parse a raw ELF header (first 64 bytes) and print magic bytes, class, and endianness.',
    estimatedMinutes: 50,
    orderIndex: 1,
    lessons: [
      {
        moduleTitle: 'Module 1: Representation & Endianness',
        titleEn: 'CPU Registers, Memory & Endianness',
        titleHi: 'सीपीयू रजिस्टर, मेमोरी और एंडियननेस',
        contentEn: 'Every security exploit and forensic investigation starts with how bytes sit in memory. Little-endian architectures (x86_64) store the least significant byte at the lowest memory address.',
        contentHi: 'प्रत्येक सुरक्षा जांच मेमोरी में बाइट्स के भंडारण से शुरू होती है। x86_64 आर्किटेक्चर में सबसे कम महत्वपूर्ण बाइट सबसे निचले मेमोरी एड्रेस पर रहता है।',
        practicalExample: 'python3 -c "import struct; print(struct.pack(\'<I\', 0xdeadbeef).hex())"',
        diagramSpec: 'CPU [RIP/RSP/RBP] <-> L1/L2 Cache <-> Stack (High->Low) / Heap (Low->High)',
        exercisesText: 'Convert 0x41424344 into little-endian bytes and identify the resulting ASCII string.',
        revisionSummary: 'Little-endian = LSB first; Stack grows toward lower addresses; NX separates code and data.',
        quizJson: {
          question: 'How is 0x12345678 stored in little-endian memory?',
          options: ['78 56 34 12', '12 34 56 78', '87 65 43 21', '34 12 78 56'],
          correctIndex: 0,
          explanation: 'Little-endian stores the least significant byte (0x78) at the lowest address first.',
        },
      },
      {
        moduleTitle: 'Module 2: Virtual Memory & Processes',
        titleEn: 'Virtual Memory, Page Tables & Privilege Rings',
        titleHi: 'वर्चुअल मेमोरी, पेज टेबल और प्रिविलेज रिंग्स',
        contentEn: 'Modern OS kernels isolate processes using virtual address spaces and MMU page permissions (Read/Write/Execute). Ring 0 kernel mode controls hardware and page tables while Ring 3 executes user binaries.',
        contentHi: 'आधुनिक OS कर्नेल वर्चुअल एड्रेस स्पेस और MMU पेज परमिशन (R/W/X) द्वारा प्रोसेस को अलग रखते हैं।',
        practicalExample: 'cat /proc/self/maps | head -n 15',
        diagramSpec: 'Ring 3 User Process (Virtual Addr) -> MMU TLB/Page Table -> Physical RAM | Syscall -> Ring 0 Kernel',
        exercisesText: 'Inspect /proc/self/maps on Linux and note why [stack] and [heap] do not carry the x (execute) bit.',
        revisionSummary: 'W^X policy prevents simultaneous write and execute page permissions.',
        quizJson: {
          question: 'Which hardware privilege level executes standard user-space applications on x86_64?',
          options: ['Ring 3', 'Ring 0', 'Ring -1', 'Ring 1'],
          correctIndex: 0,
          explanation: 'Ring 3 is least-privileged user space; Ring 0 is kernel space.',
        },
      },
    ],
  },
  {
    slug: 'stage-1-discrete-math-data-structures',
    stage: 1,
    stageTitle: 'Stage 1: Computer Fundamentals & Architecture',
    subjectArea: 'Computer Science Foundations',
    adaptiveLevel: 'Elementary',
    titleEn: 'Data Structures, Algorithms, Automata & Modular Arithmetic',
    titleHi: 'डेटा स्ट्रक्चर, एल्गोरिदम और मॉड्यूलर अंकगणित',
    summaryEn: 'Trees, graphs, hash tables, regex finite automata, modular inverse math, and time-complexity pitfalls like ReDoS.',
    summaryHi: 'ग्राफ, हैश टेबल, रेगेक्स ऑटोमेटा और मॉड्यूलर गणित जो क्रिप्टोग्राफी की नींव हैं।',
    difficulty: 'Beginner',
    prerequisiteSlug: 'stage-1-computer-fundamentals',
    prerequisitesJson: ['stage-1-computer-fundamentals'],
    learningObjectivesJson: [
      'Spot catastrophic backtracking (ReDoS) in regex engines',
      'Compute modular exponentiation used in Diffie-Hellman & RSA',
      'Model attack paths and network reachability as directed graphs',
    ],
    referencesJson: [
      { title: 'OWASP ReDoS Prevention', url: 'https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS', source: 'OWASP' },
    ],
    caseStudyText: 'Case Study: A nested quantifier regex caused 100% CPU outage on an API gateway until replaced with a linear RE2 engine.',
    projectBrief: 'Mini-Project: Benchmark a linear graph BFS shortest-path solver vs recursive backtracking.',
    estimatedMinutes: 55,
    orderIndex: 2,
    lessons: [
      {
        moduleTitle: 'Module 1: Algorithmic Complexity & ReDoS',
        titleEn: 'Regex Finite Automata & ReDoS Prevention',
        titleHi: 'रेगेक्स ऑटोमेटा और ReDoS सुरक्षा',
        contentEn: 'NFA-based regex engines backtrack exponentially on ambiguous nested quantifiers like (a+)+$, turning malformed input into CPU Denial of Service.',
        contentHi: 'अस्पष्ट नेस्टेड क्वांटिफायर्स पर बैकक्रैकिंग रेगेक्स इंजन सीपीयू डिनायल ऑफ सर्विस पैदा कर सकते हैं।',
        practicalExample: 'python3 -c "import re; print(re.fullmatch(r\'[a-zA-Z0-9_-]{3,32}\', \'nfsu_team\'))"',
        diagramSpec: 'Input String -> DFA (O(n) linear guarantee) vs Backtracking NFA (O(2^n) risk)',
        exercisesText: 'Refactor the unsafe regex ^(a+)+$ into an unambiguous character class with bounded length.',
        revisionSummary: 'Bound regex lengths and avoid nested ambiguous quantifiers.',
        quizJson: {
          question: 'Why do backtracking NFA regexes risk Denial of Service?',
          options: ['Exponential runtime on near-matching inputs', 'SQL injection inside regex', 'Buffer overflow in UTF-8', 'UDP fragmentation'],
          correctIndex: 0,
          explanation: 'Catastrophic backtracking explores exponentially many paths on crafted non-matching suffixes.',
        },
      },
    ],
  },
  {
    slug: 'stage-2-os-foundations',
    stage: 2,
    stageTitle: 'Stage 2: Linux, Windows & OS Internals',
    subjectArea: 'Operating Systems & CLI',
    adaptiveLevel: 'Beginner',
    titleEn: 'Linux Mastery, POSIX Permissions & Process Isolation',
    titleHi: 'लिनक्स मास्टरी, पॉज़िक्स परमिशन और प्रोसेस आइसोलेशन',
    summaryEn: 'Linux directory hierarchy, systemd units, SUID/capabilities, cgroups/namespaces, Bash pipelines, and auditd.',
    summaryHi: 'लिनक्स डायरेक्टरी, systemd, SUID/क्षमताएं, नेमस्पेस और बैश पाइपलाइन।',
    difficulty: 'Beginner',
    prerequisiteSlug: 'stage-1-computer-fundamentals',
    prerequisitesJson: ['stage-1-computer-fundamentals'],
    learningObjectivesJson: [
      'Audit SUID binaries and POSIX file capabilities',
      'Understand Linux namespaces and cgroups backing container isolation',
      'Automate log triage with grep, awk, jq, and systemd journalctl',
    ],
    referencesJson: [
      { title: 'GNU Bash Reference Manual', url: 'https://www.gnu.org/software/bash/manual/', source: 'GNU Project' },
    ],
    caseStudyText: 'Case Study: Overly broad CAP_SETUID file capability on an auxiliary runtime binary allowed unintended privilege elevation.',
    projectBrief: 'Mini-Project: Write a Bash audit script verifying /etc/passwd permissions, world-writable directories, and SUID files.',
    estimatedMinutes: 65,
    orderIndex: 3,
    lessons: [
      {
        moduleTitle: 'Module 1: POSIX Boundaries',
        titleEn: 'Linux File Permissions, SUID & Capabilities',
        titleHi: 'लिनक्स फाइल परमिशन, SUID और क्षमताएं',
        contentEn: 'Misconfigured SUID binaries and overly permissive sudoers entries are classic privilege escalation vectors on POSIX systems. Prefer fine-grained Linux capabilities where strictly needed.',
        contentHi: 'गलत कॉन्फ़िगर किए गए SUID बाइनरी और sudoers नियम लिनक्स में प्रिविलेज एस्केलेशन का प्रमुख कारण बनते हैं।',
        practicalExample: 'find / -perm -4000 -type f 2>/dev/null && getcap -r /usr/bin 2>/dev/null',
        diagramSpec: 'User Space (UID=1000) -> SUID Binary (EUID=0) -> Kernel Syscall Boundary',
        exercisesText: 'Check the numeric permission of /etc/shadow and explain why only root/shadow group can read it.',
        revisionSummary: '4000=SUID, 2000=SGID, 1000=Sticky bit; always drop unnecessary capabilities.',
        quizJson: {
          question: 'Which numeric permission mode sets the SUID bit alongside rwxr-xr-x?',
          options: ['4755', '2755', '1755', '0777'],
          correctIndex: 0,
          explanation: '4000 represents the SUID bit, combined with 0755 gives 4755.',
        },
      },
    ],
  },
  {
    slug: 'stage-2-windows-ad-internals',
    stage: 2,
    stageTitle: 'Stage 2: Linux, Windows & OS Internals',
    subjectArea: 'Operating Systems & CLI',
    adaptiveLevel: 'Intermediate',
    titleEn: 'Windows Internals, PowerShell, NTFS ACLs & Active Directory',
    titleHi: 'विंडोज़ इंटर्नल्स, पॉवरशेल, NTFS और एक्टिव डायरेक्टरी',
    summaryEn: 'Windows Registry hives, Event IDs (4624/4625/4688), Sysmon telemetry, NTFS permissions, and Active Directory Kerberos tickets.',
    summaryHi: 'विंडोज रजिस्ट्री, इवेंट लॉग, Sysmon और एक्टिव डायरेक्टरी Kerberos सुरक्षा।',
    difficulty: 'Intermediate',
    prerequisiteSlug: 'stage-2-os-foundations',
    prerequisitesJson: ['stage-2-os-foundations'],
    learningObjectivesJson: [
      'Correlate Windows Security Event IDs 4624, 4625, 4672, and 4688',
      'Configure PowerShell Constrained Language Mode and Script Block Logging',
      'Protect Active Directory against weak Kerberos service SPNs and unquoted paths',
    ],
    referencesJson: [
      { title: 'Microsoft Windows Security Auditing', url: 'https://learn.microsoft.com/en-us/windows/security/threat-protection/auditing/security-auditing-overview', source: 'Microsoft Learn' },
    ],
    caseStudyText: 'Case Study: Sysmon Event ID 1 process creation logs caught encoded PowerShell spawned from a macro-enabled document.',
    projectBrief: 'Mini-Project: Map 5 key Windows Security Event IDs to MITRE ATT&CK techniques.',
    estimatedMinutes: 70,
    orderIndex: 4,
    lessons: [
      {
        moduleTitle: 'Module 1: Windows Telemetry & Event Logs',
        titleEn: 'Event Logs, Sysmon & PowerShell Hardening',
        titleHi: 'इवेंट लॉग, Sysmon और पॉवरशेल हार्डनिंग',
        contentEn: 'Enabling Event ID 4688 with command-line auditing plus Sysmon DNS/network events gives defenders immediate visibility into living-off-the-land execution.',
        contentHi: 'इवेंट ID 4688 और Sysmon लॉगिंग से संदिग्ध कमांड-लाइन गतिविधि की तुरंत पहचान होती है।',
        practicalExample: 'Get-WinEvent -FilterHashtable @{LogName="Security"; ID=4625} -MaxEvents 10',
        diagramSpec: 'Process Spawn -> ETW / Sysmon Driver -> Event ID 1 & 4688 -> SIEM Forwarder',
        exercisesText: 'List the difference between Logon Type 2 (Interactive) and Logon Type 3 (Network) in Event 4624.',
        revisionSummary: '4624=Logon Success, 4625=Failed Logon, 4672=Special Privileges, 4688=Process Creation.',
        quizJson: {
          question: 'Which Windows Security Event ID records a failed account logon attempt?',
          options: ['4625', '4624', '4688', '1102'],
          correctIndex: 0,
          explanation: 'Event ID 4625 logs failed logon attempts; 4624 logs successful logons.',
        },
      },
    ],
  },
  {
    slug: 'stage-3-networking-fundamentals',
    stage: 3,
    stageTitle: 'Stage 3: Networking & Protocol Security',
    subjectArea: 'Networking & Traffic Analysis',
    adaptiveLevel: 'Beginner',
    titleEn: 'TCP/IP, Routing, DNS, HTTP/HTTPS & Packet Analysis',
    titleHi: 'TCP/IP, रूटिंग, DNS, HTTP/HTTPS और पैकेट विश्लेषण',
    summaryEn: 'OSI model, subnetting CIDR, ARP/DHCP/DNS security, TLS 1.3 handshake inspection, and Wireshark/tshark filtering.',
    summaryHi: 'OSI मॉडल, CIDR सबनेटिंग, DNS, TLS 1.3 हैंडशेक और Wireshark फ़िल्टरिंग।',
    difficulty: 'Beginner',
    prerequisiteSlug: 'stage-2-os-foundations',
    prerequisitesJson: ['stage-2-os-foundations'],
    learningObjectivesJson: [
      'Calculate CIDR IPv4 subnets and firewall ACL boundaries',
      'Inspect TCP 3-way handshakes, DNS queries, and TLS SNI fields in tshark',
      'Identify DNS tunneling and anomalous outbound beaconing patterns',
    ],
    referencesJson: [
      { title: 'Wireshark User Guide', url: 'https://www.wireshark.org/docs/wsug_html_chunked/', source: 'Wireshark Foundation' },
      { title: 'RFC 8446 TLS 1.3', url: 'https://datatracker.ietf.org/doc/html/rfc8446', source: 'IETF' },
    ],
    caseStudyText: 'Case Study: High-entropy DNS TXT queries averaging 110 bytes revealed an unauthorized DNS covert channel.',
    projectBrief: 'Mini-Project: Write tshark display filters to extract top HTTP user-agents and failed TLS handshakes.',
    estimatedMinutes: 75,
    orderIndex: 5,
    lessons: [
      {
        moduleTitle: 'Module 1: Packet Inspection',
        titleEn: 'TCP 3-Way Handshake, DNS & TLS 1.3',
        titleHi: 'TCP हैंडशेक, DNS और TLS 1.3',
        contentEn: 'Analyzing SYN, SYN-ACK, ACK sequences and TLS ClientHello SNI fields lets defenders spot anomalous beacons and unauthorized tunnels.',
        contentHi: 'SYN, SYN-ACK, ACK और TLS ClientHello SNI फ़ील्ड का विश्लेषण नेटवर्क सुरक्षा के लिए अत्यंत आवश्यक है।',
        practicalExample: 'tshark -r capture.pcap -Y "tls.handshake.type == 1" -T fields -e tls.handshake.extensions_server_name',
        diagramSpec: 'Client --SYN--> Server --SYN/ACK--> Client --ACK + TLS 1.3 ClientHello--> Server',
        exercisesText: 'Explain why TLS 1.3 removes RSA key transport in favor of ephemeral ECDHE.',
        revisionSummary: 'TLS 1.3 guarantees Perfect Forward Secrecy (PFS) via ephemeral key exchange.',
        quizJson: {
          question: 'Which Wireshark display filter isolates HTTP POST requests?',
          options: ['http.request.method == "POST"', 'tcp.port == POST', 'http.method = POST', 'ip.proto == HTTP'],
          correctIndex: 0,
          explanation: 'http.request.method == "POST" is valid Wireshark display filter syntax.',
        },
      },
    ],
  },
  {
    slug: 'stage-4-programming-python-bash',
    stage: 4,
    stageTitle: 'Stage 4: Programming & Secure Coding',
    subjectArea: 'Programming & Scripting',
    adaptiveLevel: 'Intermediate',
    titleEn: 'Python Security Automation, SQL Safety & C/Memory Safety',
    titleHi: 'पायथन ऑटोमेशन, SQL सुरक्षा और C मेमोरी सुरक्षा',
    summaryEn: 'Write defensive scanners in Python, prevent SQL/command injection, and compare C/C++ buffer risks against Rust memory safety.',
    summaryHi: 'पायथन सुरक्षा स्क्रिप्ट, SQL इंजेक्शन रोकथाम और C बनाम Rust मेमोरी सुरक्षा।',
    difficulty: 'Intermediate',
    prerequisiteSlug: 'stage-3-networking-fundamentals',
    prerequisitesJson: ['stage-3-networking-fundamentals'],
    learningObjectivesJson: [
      'Eliminate SQL injection using bound parameterized statements',
      'Eliminate OS command injection by passing argv arrays instead of shell strings',
      'Identify stack buffer overflows in C (gets, strcpy) and safe bounds checks',
    ],
    referencesJson: [
      { title: 'OWASP Secure Coding Practices', url: 'https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/', source: 'OWASP' },
    ],
    caseStudyText: 'Case Study: Migrating legacy child_process.exec shell strings to execFile with fixed argument arrays stopped injection vectors.',
    projectBrief: 'Mini-Project: Build a Python script validating SHA-256 checksums across a directory tree.',
    estimatedMinutes: 85,
    orderIndex: 6,
    lessons: [
      {
        moduleTitle: 'Module 1: Injection Prevention',
        titleEn: 'Parameterized SQL vs String Concatenation',
        titleHi: 'पैरामीटराइज्ड SQL बनाम स्ट्रिंग कॉनकैटेनेशन',
        contentEn: 'Never interpolate user input directly into SQL statements. Always use bound parameters or type-safe ORM query builders so data cannot become SQL syntax.',
        contentHi: 'यूज़र इनपुट को कभी भी सीधे SQL क्वेरी में न जोड़ें। हमेशा पैरामीटराइज्ड क्वेरी का उपयोग करें।',
        practicalExample: 'SELECT id, username FROM users WHERE id = $1;',
        diagramSpec: 'User Input -> Parameterized Placeholder ($1) -> DB Query Planner (Data Only)',
        exercisesText: 'Rewrite an insecure Python sqlite3 f-string query into a ? placeholder query.',
        revisionSummary: 'Separate code AST from untrusted user data using bound parameters.',
        quizJson: {
          question: 'What is the primary defense against SQL injection?',
          options: ['Parameterized queries / prepared statements', 'Client-side regex filtering only', 'Hiding table names', 'Base64 encoding inputs'],
          correctIndex: 0,
          explanation: 'Prepared statements separate SQL code structure from user-supplied data.',
        },
      },
      {
        moduleTitle: 'Module 2: Systems Programming & Memory Safety',
        titleEn: 'C/C++ Undefined Behavior vs Go & Rust Ownership',
        titleHi: 'C/C++ मेमोरी त्रुटियां बनाम Go और Rust सुरक्षा',
        contentEn: 'Unbounded C functions like strcpy/sprintf invite stack corruption and use-after-free bugs. Compilers add ASAN/UBSAN during testing, while Rust enforces ownership at compile time.',
        contentHi: 'C में असुरक्षित मेमोरी कॉपी बफर ओवरफ्लो पैदा करती है, जबकि Rust कंपाइल-टाइम ओनरशिप लागू करता है।',
        practicalExample: 'gcc -fsanitize=address,undefined -Wall -Wextra -Werror safe_parser.c -o safe_parser',
        diagramSpec: 'C strcpy() -> Overwrites Saved RBP/RIP | Rust Borrow Checker -> Compile-Time Rejection',
        exercisesText: 'Compile a small C test harness with -fsanitize=address to catch a 1-byte off-by-one heap write.',
        revisionSummary: 'Always enable AddressSanitizer in CI pipelines for C/C++ native code.',
        quizJson: {
          question: 'Which GCC/Clang flag enables runtime detection of out-of-bounds reads and use-after-free?',
          options: ['-fsanitize=address', '-O3', '-static', '-s'],
          correctIndex: 0,
          explanation: '-fsanitize=address compiles in AddressSanitizer (ASan) instrumentation.',
        },
      },
    ],
  },
  {
    slug: 'stage-5-cybersecurity-fundamentals',
    stage: 5,
    stageTitle: 'Stage 5: Cybersecurity & Cryptography Core',
    subjectArea: 'Cybersecurity & Cryptography',
    adaptiveLevel: 'Intermediate',
    titleEn: 'Applied Cryptography, IAM, OAuth2/OIDC & Risk Governance',
    titleHi: 'अप्लाइड क्रिप्टोग्राफी, IAM, OAuth2/OIDC और रिस्क गवर्नेंस',
    summaryEn: 'AES-GCM AEAD, HMAC, Argon2id password hashing, OAuth2 PKCE, RBAC/ABAC, and NIST RMF governance.',
    summaryHi: 'AES-GCM, HMAC, Argon2id, OAuth2 PKCE और RBAC सुरक्षा सिद्धांत।',
    difficulty: 'Intermediate',
    prerequisiteSlug: 'stage-4-programming-python-bash',
    prerequisitesJson: ['stage-4-programming-python-bash'],
    learningObjectivesJson: [
      'Implement constant-time HMAC verification with crypto.timingSafeEqual',
      'Choose Argon2id or scrypt over fast hashes (SHA-256) for user passwords',
      'Enforce RBAC + object-level authorization cleanly on backend endpoints',
    ],
    referencesJson: [
      { title: 'NIST SP 800-63B Digital Identity', url: 'https://pages.nist.gov/800-63-3/sp800-63b.html', source: 'NIST' },
    ],
    caseStudyText: 'Case Study: Storing salted HMAC webhook verifiers with constant-time comparison stopped blind timing oracle enumeration.',
    projectBrief: 'Mini-Project: Implement AES-256-GCM envelope encryption with fresh 96-bit CSPRNG nonces in Node.js or Python.',
    estimatedMinutes: 90,
    orderIndex: 7,
    lessons: [
      {
        moduleTitle: 'Module 1: Integrity & Timing Safety',
        titleEn: 'Authenticated Encryption & Constant-Time Verification',
        titleHi: 'ऑथेंटिकेटेड एन्क्रिप्शन और कॉन्स्टेंट-टाइम वेरिफिकेशन',
        contentEn: 'Using HMAC with timingSafeEqual prevents timing side-channel leaks when validating tokens, webhook signatures, or CTF flags.',
        contentHi: 'timingSafeEqual के साथ HMAC का उपयोग टोकन और फ़्लैग सत्यापन में टाइमिंग अटैक को रोकता है।',
        practicalExample: 'crypto.timingSafeEqual(Buffer.from(digestA, "hex"), Buffer.from(digestB, "hex"))',
        diagramSpec: 'Plaintext -> AES-256-GCM (Key, Nonce, AAD) -> Ciphertext + Auth Tag',
        exercisesText: 'Why must an AES-GCM key/nonce pair NEVER be reused across two different messages?',
        revisionSummary: 'AEAD protects both confidentiality and integrity; never reuse GCM nonces.',
        quizJson: {
          question: 'Why use crypto.timingSafeEqual instead of === for secret comparison?',
          options: ['Prevents timing side-channel attacks', 'Compresses the string', 'Encrypts the database', 'Avoids UTF-8 encoding'],
          correctIndex: 0,
          explanation: 'Standard equality returns immediately on the first mismatched byte.',
        },
      },
    ],
  },
  {
    slug: 'stage-6-web-api-ethical-hacking',
    stage: 6,
    stageTitle: 'Stage 6: Ethical Hacking, Web & API Security',
    subjectArea: 'Ethical Hacking & Web/API Security',
    adaptiveLevel: 'Upper Intermediate',
    titleEn: 'OWASP Top 10, API Security Top 10 & Authorized Pentesting',
    titleHi: 'OWASP Top 10, API सुरक्षा और अधिकृत पेनिट्रेशन टेस्टिंग',
    summaryEn: 'Broken Access Control (BOLA/IDOR), SSRF defenses, XSS/CSP, CSRF tokens, JWT algorithm confusion fixes, and reporting.',
    summaryHi: 'BOLA/IDOR, SSRF सुरक्षा, XSS/CSP और सुरक्षित API डिज़ाइन।',
    difficulty: 'Intermediate',
    prerequisiteSlug: 'stage-5-cybersecurity-fundamentals',
    prerequisitesJson: ['stage-5-cybersecurity-fundamentals'],
    learningObjectivesJson: [
      'Audit API routes for Broken Object Level Authorization (BOLA/IDOR)',
      'Harden SSRF vulnerabilities by blocking RFC1918/metadata IPs (169.254.169.254)',
      'Verify JWT asymmetric algorithms explicitly rather than trusting header alg',
    ],
    referencesJson: [
      { title: 'OWASP API Security Top 10', url: 'https://owasp.org/API-Security/', source: 'OWASP' },
    ],
    caseStudyText: 'Case Study: Blocking cloud metadata endpoint 169.254.169.254 in outbound URL fetchers neutralized an SSRF exposure.',
    projectBrief: 'Mini-Project: Write an Express middleware enforcing resource ownership checks and strict URL allowlisting.',
    estimatedMinutes: 100,
    orderIndex: 8,
    lessons: [
      {
        moduleTitle: 'Module 1: Access Control & SSRF',
        titleEn: 'OWASP Broken Access Control & Authorization Testing',
        titleHi: 'OWASP ब्रोकन एक्सेस कंट्रोल और ऑथराइजेशन टेस्टिंग',
        contentEn: 'Always enforce object-level ownership and role checks server-side. Never trust client-supplied role flags, team IDs, or hidden form fields.',
        contentHi: 'ऑब्जेक्ट-लेवल ओनरशिप और रोल जांच हमेशा सर्वर पर लागू करें। क्लाइंट-साइड डेटा पर भरोसा न करें।',
        practicalExample: 'if (record.ownerId !== req.user.id && req.user.role !== "owner") return res.status(403).end();',
        diagramSpec: 'Browser -> Burp Proxy -> API Gateway -> Server RBAC + Ownership Check -> Resource',
        exercisesText: 'Review 3 REST endpoints and write unit tests verifying 403 Forbidden for non-owners.',
        revisionSummary: 'Deny by default; verify authentication + role + ownership on every route.',
        quizJson: {
          question: 'Which vulnerability occurs when a user changes /api/team/1 to /api/team/2 and reads private chat?',
          options: ['Broken Object Level Authorization (IDOR)', 'Clickjacking', 'Reflected XSS', 'DNS Cache Poisoning'],
          correctIndex: 0,
          explanation: 'Missing object-level authorization lets users access another tenant record by ID.',
        },
      },
    ],
  },
  {
    slug: 'stage-7-blue-team-soc-dfir',
    stage: 7,
    stageTitle: 'Stage 7: Blue Team, SOC & Digital Forensics',
    subjectArea: 'Blue Team, SOC & Forensics',
    adaptiveLevel: 'Advanced',
    titleEn: 'SOC Operations, SIEM Correlation, Sigma Rules & Memory DFIR',
    titleHi: 'SOC ऑपरेशंस, SIEM सहसंबंधन, Sigma नियम और मेमोरी फॉरेंसिक्स',
    summaryEn: 'NIST IR lifecycle, Sigma detection authoring, Volatility memory analysis, chain of custody, and threat hunting.',
    summaryHi: 'इंसिडेंट रिस्पॉन्स, Sigma नियम लेखन, मेमोरी फॉरेंसिक्स और थ्रेट हंटिंग।',
    difficulty: 'Hard',
    prerequisiteSlug: 'stage-6-web-api-ethical-hacking',
    prerequisitesJson: ['stage-6-web-api-ethical-hacking'],
    learningObjectivesJson: [
      'Preserve volatile memory and SHA-256 chain of custody before remediation',
      'Author Sigma rules targeting suspicious encoded command executions',
      'Detect process hollowing via pslist vs psscan cross-checks',
    ],
    referencesJson: [
      { title: 'MITRE ATT&CK Enterprise Matrix', url: 'https://attack.mitre.org/', source: 'MITRE' },
      { title: 'NIST SP 800-61 Computer Security Incident Handling', url: 'https://csrc.nist.gov/publications/detail/sp/800-61/rev-2/final', source: 'NIST' },
    ],
    caseStudyText: 'Case Study: Combining NetFlow anomaly alerts with Linux auditd execve logs isolated lateral SSH pivoting within 4 minutes.',
    projectBrief: 'Mini-Project: Write a Sigma rule matching unexpected curl/wget downloads from /tmp initiated by web-server UIDs.',
    estimatedMinutes: 120,
    orderIndex: 9,
    lessons: [
      {
        moduleTitle: 'Module 1: Incident Handling & Evidence',
        titleEn: 'Incident Response Containment & Evidence Preservation',
        titleHi: 'इंसिडेंट रिस्पॉन्स कंटेनमेंट और साक्ष्य संरक्षण',
        contentEn: 'During an active compromise, preserve volatile memory and immutable audit logs before terminating compromised workloads or revoking session tokens.',
        contentHi: 'किसी साइबर घटना के दौरान, सत्र रद्द करने से पहले मेमोरी और ऑडिट लॉग को सुरक्षित रखना अनिवार्य है।',
        practicalExample: 'sha256sum memory_dump.raw > evidence_chain.sha256',
        diagramSpec: 'Detect -> Triage -> Preserve Evidence -> Contain -> Eradicate -> Recover -> Lessons Learned',
        exercisesText: 'Order volatile sources by order of volatility (CPU registers -> RAM -> network sockets -> disk).',
        revisionSummary: 'Collect most volatile artifacts first; hash all evidence immediately.',
        quizJson: {
          question: 'Which step comes immediately after preserving forensic evidence during containment?',
          options: ['Isolate affected host / revoke compromised credentials', 'Format the hard drive', 'Delete audit logs', 'Restart without logging'],
          correctIndex: 0,
          explanation: 'Containment isolates blast radius while keeping preserved evidence intact.',
        },
      },
    ],
  },
  {
    slug: 'stage-7-cloud-devsecops-k8s',
    stage: 7,
    stageTitle: 'Stage 7: Cloud, DevSecOps & Modern Infrastructure',
    subjectArea: 'Emerging Tech & Cloud Security',
    adaptiveLevel: 'Advanced',
    titleEn: 'Cloud IAM, Containers, Kubernetes RBAC, DevSecOps & AI/LLM Security',
    titleHi: 'क्लाउड IAM, कंटेनर, Kubernetes RBAC, DevSecOps और AI/LLM सुरक्षा',
    summaryEn: 'Zero-trust IAM least privilege, container seccomp/AppArmor profiles, Kubernetes Pod Security Standards, SBOMs, and OWASP Top 10 for LLMs.',
    summaryHi: 'क्लाउड IAM, कंटेनर और Kubernetes सुरक्षा, CI/CD पाइपलाइन और AI/LLM प्रॉम्प्ट सुरक्षा।',
    difficulty: 'Hard',
    prerequisiteSlug: 'stage-6-web-api-ethical-hacking',
    prerequisitesJson: ['stage-6-web-api-ethical-hacking'],
    learningObjectivesJson: [
      'Audit overly permissive IAM wildcard policies and IMDSv1 exposures',
      'Harden Kubernetes Pods (runAsNonRoot, drop ALL capabilities, readOnlyRootFilesystem)',
      'Mitigate Prompt Injection & Excessive Agency in LLM integrations',
    ],
    referencesJson: [
      { title: 'OWASP Top 10 for LLM Applications', url: 'https://owasp.org/www-project-top-10-for-large-language-model-applications/', source: 'OWASP' },
      { title: 'Kubernetes Pod Security Standards', url: 'https://kubernetes.io/docs/concepts/security/pod-security-standards/', source: 'Kubernetes Docs' },
    ],
    caseStudyText: 'Case Study: Switching AWS EC2 nodes to IMDSv2 + dropping NET_RAW capabilities prevented container SSRF credential theft.',
    projectBrief: 'Mini-Project: Harden a Kubernetes Deployment manifest to satisfy the Restricted Pod Security Standard.',
    estimatedMinutes: 110,
    orderIndex: 10,
    lessons: [
      {
        moduleTitle: 'Module 1: Container & LLM Hardening',
        titleEn: 'Kubernetes Isolation & OWASP LLM Defense',
        titleHi: 'Kubernetes आइसोलेशन और LLM प्रॉम्प्ट सुरक्षा',
        contentEn: 'Containers share a single Linux kernel. Enforce non-root UIDs, seccomp profiles, and read-only root filesystems. For AI tools, never grant raw SQL or shell execution directly from unvalidated LLM output.',
        contentHi: 'कंटेनर एक ही लिनक्स कर्नेल साझा करते हैं—हमेशा non-root और seccomp लागू करें।',
        practicalExample: 'kubectl auth can-i --list --namespace=production',
        diagramSpec: 'Pod (non-root, seccomp) -> K8s NetworkPolicy -> Least-Privilege IAM ServiceAccount',
        exercisesText: 'Identify why hostPath volume mounts break Kubernetes container boundaries.',
        revisionSummary: 'Never mount docker.sock or hostPath / inside untrusted workload Pods.',
        quizJson: {
          question: 'Which Kubernetes securityContext setting prevents privilege escalation inside a Pod?',
          options: ['allowPrivilegeEscalation: false', 'hostNetwork: true', 'privileged: true', 'runAsUser: 0'],
          correctIndex: 0,
          explanation: 'Setting allowPrivilegeEscalation: false disables SUID/capability elevation inside the container.',
        },
      },
    ],
  },
  {
    slug: 'stage-8-malware-re-exploitation',
    stage: 8,
    stageTitle: 'Stage 8: Expert Reverse Engineering & Binary Exploitation',
    subjectArea: 'Malware Analysis, RE & Binary Exploitation',
    adaptiveLevel: 'Expert',
    titleEn: 'ELF/PE Reverse Engineering, Binary Hardening & YARA Signatures',
    titleHi: 'रिवर्स इंजीनियरिंग, बाइनरी हार्डनिंग और YARA सिग्नेचर',
    summaryEn: 'Ghidra/radare2 static disassembly, GOT/PLT, ASLR/PIE/NX/Stack Canaries, coverage-guided fuzzing (libFuzzer/AFL++), and YARA rules.',
    summaryHi: 'ELF/PE रिवर्स इंजीनियरिंग, ASLR/PIE सुरक्षा, फ़ज़िंग और YARA नियम।',
    difficulty: 'Expert',
    prerequisiteSlug: 'stage-7-blue-team-soc-dfir',
    prerequisitesJson: ['stage-7-blue-team-soc-dfir'],
    learningObjectivesJson: [
      'Audit ELF binary mitigations (RELRO, Canary, NX, PIE) and identify gaps',
      'Analyze x86_64 calling conventions (rdi, rsi, rdx, rcx, r8, r9) in disassembly',
      'Write robust YARA detection rules combining strings and PE/ELF structural conditions',
    ],
    referencesJson: [
      { title: 'Ghidra Official Documentation', url: 'https://ghidra-sre.org/', source: 'NSA / Open Source' },
      { title: 'YARA Documentation', url: 'https://yara.readthedocs.io/', source: 'VirusTotal / YARA' },
    ],
    caseStudyText: 'Case Study: High Shannon entropy in .rodata combined with XOR loops revealed a packed config table inside a triage sample.',
    projectBrief: 'Mini-Project: Run AFL++ fuzzing on a small C parser with ASan enabled and analyze any crash inputs.',
    estimatedMinutes: 150,
    orderIndex: 11,
    lessons: [
      {
        moduleTitle: 'Module 1: Binary Triage & Detection',
        titleEn: 'ELF Binary Triage & YARA Detection Engineering',
        titleHi: 'ELF बाइनरी ट्राइएज और YARA डिटेक्शन इंजीनियरिंग',
        contentEn: 'Combine ELF section inspection, strings/entropy analysis, and YARA signatures to detect packed implants inside isolated sandbox microVMs.',
        contentHi: 'आइसोलेटेड सैंडबॉक्स में मैलवेयर की पहचान के लिए ELF सेक्शन और YARA सिग्नेचर का उपयोग करें।',
        practicalExample: 'readelf -S sample.bin && objdump -d -M intel sample.bin | head -n 35',
        diagramSpec: 'Binary Sample -> Static Triage (ELF/PE) -> Isolated MicroVM Detonation -> YARA Rule',
        exercisesText: 'Interpret the 6 integer argument registers used by the System V AMD64 ABI.',
        revisionSummary: 'SysV AMD64 args: rdi, rsi, rdx, rcx, r8, r9; return value in rax.',
        quizJson: {
          question: 'What does unusually high Shannon entropy (>7.2) in a binary section typically indicate?',
          options: ['Encryption or packing/obfuscation', 'Plain ASCII documentation', 'Empty zero-padded space', 'Debug symbol tables'],
          correctIndex: 0,
          explanation: 'Encrypted or compressed payloads have near-uniform byte distributions (>7.2 bits/byte).',
        },
      },
    ],
  },
  {
    slug: 'stage-8-research-kernel-pqc',
    stage: 8,
    stageTitle: 'Stage 8: Research & Specialist Level Security',
    subjectArea: 'Advanced Security Research',
    adaptiveLevel: 'Research and Specialist Level',
    titleEn: 'Kernel Isolation, Formal Verification & Post-Quantum Cryptography (ML-KEM)',
    titleHi: 'कर्नेल आइसोलेशन, फॉर्मल वेरिफिकेशन और पोस्ट-क्वांटम क्रिप्टोग्राफी',
    summaryEn: 'MicroVM isolation (Firecracker/KVM), side-channel timing invariance, fuzzing parsers, and NIST FIPS 203 (ML-KEM / Kyber) & FIPS 204 (ML-DSA).',
    summaryHi: 'Firecracker microVM आइसोलेशन, साइड-चैनल सुरक्षा और NIST पोस्ट-क्वांटम मानक।',
    difficulty: 'Expert',
    prerequisiteSlug: 'stage-8-malware-re-exploitation',
    prerequisitesJson: ['stage-8-malware-re-exploitation'],
    learningObjectivesJson: [
      'Understand NIST FIPS 203 ML-KEM lattice key encapsulation vs RSA/ECDH',
      'Compare gVisor/Firecracker microVM isolation against standard Linux containers',
      'Design hybrid classical + post-quantum TLS key migration strategies',
    ],
    referencesJson: [
      { title: 'NIST FIPS 203 (ML-KEM)', url: 'https://csrc.nist.gov/pubs/fips/203/final', source: 'NIST' },
      { title: 'NIST FIPS 204 (ML-DSA)', url: 'https://csrc.nist.gov/pubs/fips/204/final', source: 'NIST' },
    ],
    caseStudyText: 'Case Study: Adopting hybrid X25519+ML-KEM768 key exchange mitigates harvest-now-decrypt-later threats without sacrificing classical security.',
    projectBrief: 'Research Seminar: Survey 2 recent papers from IEEE S&P / USENIX Security on microVM sandboxing or cryptographic timing.',
    estimatedMinutes: 180,
    orderIndex: 12,
    lessons: [
      {
        moduleTitle: 'Module 1: Post-Quantum & MicroVM Boundaries',
        titleEn: 'ML-KEM Key Encapsulation & Hardware Virtualization',
        titleHi: 'ML-KEM पोस्ट-क्वांटम क्रिप्टोग्राफी और हार्डवेयर वर्चुअलाइजेशन',
        contentEn: 'Harvest-now, decrypt-later adversaries capture classical TLS handshakes today. NIST FIPS 203 (ML-KEM) pairs cleanly with X25519 in hybrid key exchange. Meanwhile, hardware-virtualized microVMs give each untrusted lab its own guest kernel.',
        contentHi: 'पोस्ट-क्वांटम युग के लिए ML-KEM हाइब्रिड क्रिप्टोग्राफी और microVM कर्नेल आइसोलेशन भविष्य की सुरक्षा मानक हैं।',
        practicalExample: 'openssl version && openssl list -kem-algorithms | grep -i mlkem',
        diagramSpec: 'Client (X25519 + ML-KEM768) <-> Hybrid KDF -> Quantum-Resilient Session Key',
        exercisesText: 'Compare the ciphertext and public key sizes of ML-KEM-768 vs X25519.',
        revisionSummary: 'Hybrid cryptography preserves classical guarantees while adding lattice-based quantum resistance.',
        quizJson: {
          question: 'Which NIST standard specifies the Module-Lattice-Based Key-Encapsulation Mechanism (formerly Kyber)?',
          options: ['FIPS 203 (ML-KEM)', 'FIPS 197 (AES)', 'FIPS 180-4 (SHA)', 'RFC 791 (IPv4)'],
          correctIndex: 0,
          explanation: 'NIST finalized ML-KEM as FIPS 203 in 2024.',
        },
      },
    ],
  },
];

export interface SeedDiagnosticInput {
  slug: string;
  title: string;
  subjectArea: string;
  description: string;
  questionsJson: Array<{
    id: string;
    prompt: string;
    options: string[];
    correctIndex: number;
    weight: number;
    explanation: string;
  }>;
}

export const DIAGNOSTIC_ASSESSMENTS: SeedDiagnosticInput[] = [
  {
    slug: 'initial-placement',
    title: 'Initial Comprehensive Skill Placement Diagnostic',
    subjectArea: 'Overall Cybersecurity & CS',
    description:
      'Calibrates your starting level from Absolute Beginner through Research Level across Computer Architecture, Linux, Networking, Cryptography, Web Security, and Forensics. Scoring 50%+ unlocks intermediate/advanced tracks without forcing beginner steps.',
    questionsJson: [
      {
        id: 'q1',
        prompt: 'How is the 32-bit integer 0xAABBCCDD laid out in little-endian RAM from lowest address upward?',
        options: ['DD CC BB AA', 'AA BB CC DD', 'BB AA DD CC', 'DD AA BB CC'],
        correctIndex: 0,
        weight: 1,
        explanation: 'Little-endian stores least-significant byte (0xDD) at the lowest memory address.',
      },
      {
        id: 'q2',
        prompt: 'Which Linux file permission numeric mode enables SUID on a rwxr-xr-x binary?',
        options: ['4755', '2755', '1755', '7755'],
        correctIndex: 0,
        weight: 1,
        explanation: '4000 is SUID, 2000 is SGID, 1000 is sticky.',
      },
      {
        id: 'q3',
        prompt: 'Which protocol upgrade prevents harvest-now decrypt-later interception on long-lived TLS traffic?',
        options: ['Hybrid ECDHE + ML-KEM (FIPS 203)', 'Static RSA key transport', 'SSLv3 fallback', 'MD5 HMAC'],
        correctIndex: 0,
        weight: 2,
        explanation: 'Hybrid ephemeral ECDHE + ML-KEM adds post-quantum forward secrecy.',
      },
      {
        id: 'q4',
        prompt: 'What is the most reliable defense against SSRF when an API accepts a webhook URL?',
        options: ['Validate scheme + resolve IP and block loopback/RFC1918/link-local metadata ranges + disable uncontrolled redirects', 'Check only if URL starts with https://', 'Block the word localhost via regex', 'Base64 encode the URL'],
        correctIndex: 0,
        weight: 2,
        explanation: 'Regex string checks are bypassed via IPv6, decimal IPs, or DNS rebinding; post-resolution IP pinning is required.',
      },
      {
        id: 'q5',
        prompt: 'Why should security tokens be compared with crypto.timingSafeEqual instead of ===?',
        options: ['Eliminates early-exit timing side-channel leaks', 'Reduces RAM allocations', 'Compresses SHA-256 digests', 'Prevents XSS in DOM'],
        correctIndex: 0,
        weight: 2,
        explanation: 'Short-circuit string comparison leaks byte prefixes through response latency differences.',
      },
      {
        id: 'q6',
        prompt: 'In an ELF binary, what does a section with Shannon entropy ~7.9 bits/byte usually imply?',
        options: ['Packed, compressed, or encrypted payload', 'Unencrypted ASCII help strings', 'Empty BSS padding', 'DWARF line debug tables'],
        correctIndex: 0,
        weight: 2,
        explanation: 'High entropy reflects near-random byte distribution typical of encryption or compression.',
      },
    ],
  },
  {
    slug: 'linux-networking-diagnostic',
    title: 'Linux, OS & Networking Verification Quiz',
    subjectArea: 'Operating Systems & Networking',
    description: 'Assess your mastery of POSIX boundaries, systemd, CIDR subnetting, DNS, and packet triage.',
    questionsJson: [
      {
        id: 'ln1',
        prompt: 'Which Wireshark filter matches DNS queries for TXT records?',
        options: ['dns.qry.type == 16', 'dns.txt == true', 'udp.txt == 53', 'tcp.dns.txt'],
        correctIndex: 0,
        weight: 1,
        explanation: 'DNS resource record type 16 corresponds to TXT records.',
      },
      {
        id: 'ln2',
        prompt: 'How many usable host addresses exist in a /26 IPv4 subnet?',
        options: ['62', '64', '30', '126'],
        correctIndex: 0,
        weight: 1,
        explanation: '2^(32-26) - 2 = 64 - 2 = 62 usable host addresses.',
      },
      {
        id: 'ln3',
        prompt: 'Which Linux command displays POSIX capabilities granted to binaries under /usr/bin?',
        options: ['getcap -r /usr/bin', 'lsattr -R /usr/bin', 'chacl -l /usr/bin', 'sysctl -a cap'],
        correctIndex: 0,
        weight: 1,
        explanation: 'getcap inspects file capabilities assigned via setcap.',
      },
    ],
  },
  {
    slug: 'appsec-crypto-diagnostic',
    title: 'AppSec, Cryptography & DFIR Placement Quiz',
    subjectArea: 'Web Security, Crypto & Forensics',
    description: 'Verify intermediate-to-research proficiency in OWASP API Top 10, AEAD, and memory forensics.',
    questionsJson: [
      {
        id: 'ac1',
        prompt: 'What happens if the same 96-bit nonce and key are reused in AES-GCM?',
        options: ['Keystream reuse exposes plaintext XORs and leaks the GHASH authentication key H', 'AES switches automatically to CBC', 'Only the first 16 bytes leak', 'Nothing if the plaintext differs'],
        correctIndex: 0,
        weight: 2,
        explanation: 'AES-GCM uses CTR mode + GHASH; nonce reuse allows XOR recovery and forgery.',
      },
      {
        id: 'ac2',
        prompt: 'Which OWASP vulnerability lets user A view /api/teams/42/audit despite not belonging to team 42?',
        options: ['BOLA / IDOR (Broken Object Level Authorization)', 'Clickjacking', 'DOM Clobbering', 'Subdomain Takeover'],
        correctIndex: 0,
        weight: 1,
        explanation: 'Failing to enforce object-level ownership on server APIs is BOLA/IDOR.',
      },
      {
        id: 'ac3',
        prompt: 'In forensic triage, why acquire RAM before running antivirus remediation on disk?',
        options: ['Volatile artifacts (unlinked binaries, decrypted keys, network sockets) are lost if rebooted or killed', 'RAM compresses disk files', 'Antivirus deletes BIOS firmware', 'Memory dumps are faster than ls'],
        correctIndex: 0,
        weight: 2,
        explanation: 'Order of volatility requires capturing live memory and active sockets before destructive remediation.',
      },
    ],
  },
];
