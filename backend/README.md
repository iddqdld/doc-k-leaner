# Structure commence 

we are using docstring called by """ comment """ so we have docs up to date compiled using OpenAPI they also good for describind each function you can see them in code too.
---
core/config.py 
1) File size limit
2) File types limit (whitelist)
3) MIME types whitelist (Multipurpose Internet Mail Extension) 
ICI avec les mime il faut implementer le check contre le file rename (MIME type change pas meme si on a change le nom de ficher)
Example : qqch.exe rename cfg.yaml (il va passer le .yml check, mais MIME will be .exe still)

---
schemas/fileupload.py
core logic defined in this file

definition de BaseModel pour utiliser pydantic to validate and tag all the data we recieve.
en generale c un fichier pour definire le format de data, on va lui utiliser en creation de nos function API.
when we parse them as two entries, the program is more optimized (memory usage wise, as we read metadata more often than content)

Gab V specifiquement pour toi par example le nettoyage de data part 
Convert to JSON string
    metadata.model_dump_json()  # '{"file_id": "abc", "filename": "test.yml", "size": 1024}'
il y a beacoup plus de fonctionalite dans pydantic on a definie que la structure la pour tout future developement.

So, we are using pipeline method to send both parts toghether to our redis server, so we don't get corrupted data if smth happens betwen sending part1(metadata) and part2(content) (ex. server crash). we are prepering them and then sending, this permits us to have all or nothing result. we either got everything or nothing. 
---
api/files.py
pretty selfexplanatory, better to check the file to get more info

added links normalisation for github and gitlab. 

schemas/admin.py 
admin dashboard api

db --> is postgre init

added storage service and db service files in ./services 
they are additional files to connect postgre storage

+ psycopg[binary] in requirements so we can talk with our db.

Solidity Guard (https://github.com/alt-research/SolidityGuard?tab=readme-ov-file#) very cool tech: 

it is ran in it's own docker container. we are integrated:
internal endpoints + client to call solidity gurad api.
generating pdf's reports
has 2 mods quick and normal
accepts only .sol (solidity) type of files < 5mb (they are super light normally)
tested via OpenAI EVM benchmark 100% passed

full list of their features
104 Vulnerability Patterns (ETH-001 to ETH-104) — from real audits, exploits, SWC Registry, OWASP 2025, and 2025-2026 research
9-Tool Integration — Slither, Mythril, Echidna, Aderyn, Foundry v1.0, Medusa v1, Halmos, Certora, EVMBench
3 Application Surfaces — CLI, Web (solidityguard.org), Desktop (Tauri v2)
Docker Support — scan locally with zero setup, your code never leaves your machine
Professional Reports — OpenZeppelin/Trail of Bits-style Markdown + PDF with severity scoring
7-Phase Deep Audit — scan, verify, parallel agents, exploit PoC, dynamic verification, fuzz, report
Multi-Agent Architecture — 9 specialized sub-agents for deep parallel analysis
Dynamic Exploit Verification — Foundry fork-based PoC testing on forked mainnet
Formal Verification — Halmos symbolic tests + Certora CVL rules
Fuzz Test Generation — Foundry invariant tests + Echidna property tests from scan findings
OWASP 2025 Aligned — covers all Smart Contract Top 10 2025 categories
CTF-Validated — 100% detection on 85/85 challenges: DeFiVulnLabs (56/56) + Paradigm CTF (24/24) + R3CTF 2025 + HTB CA 2025 (5/5)
EVMBench Validated — 120/120 (100%) ground-truth vulnerability coverage across 40 real-world audits

we are integrated only lightweight model (Slither + pattern Recognition)

was tested on some bulletproff contracts such as ERC20.sol and UniswapV3Pool.sol as well as https://www.damnvulnerabledefi.xyz/ they have challanges with vulnerbale smart-contracts 