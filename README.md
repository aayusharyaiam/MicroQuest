# MicroQuest

A personal, gamified **8085 + original 8086 assembly learning website**. Built with React, TypeScript, and Vite; the deployed app is static files. Firebase Authentication + Firestore provide optional account-based cross-device saving without an application server.

## Start the website

Requirements: Node.js 20.19+ or 22+ and npm.

```bash
npm install
npm run dev
```

Open the URL shown by Vite (normally `http://localhost:5173`). The website works immediately in guest mode with local progress saving. To build a deployable version:

```bash
npm run build
npm run preview
```

Upload the **`dist` folder** to Netlify, Cloudflare Pages, Firebase Hosting, GitHub Pages, or another static host. On hosts with build settings, use `npm run build` as the build command and `dist` as the output directory. Hash-based navigation works without server-side route rewrites. Relative asset paths support deployment under a subdirectory.

## What is included

- **11 8085 lessons and 12 8086 lessons**, starting with CPU concepts, number systems, memory, registers, and flags.
- Lessons explaining data transfer, arithmetic, bit logic, branching, stack/procedures, I/O/control, plus 8086 string operations.
- A searchable reference for documented original-processor mnemonics, aliases, and prefixes, with syntax, flag effects, and runnable/reference-only markers.
- A three-question MCQ quiz and a fill-in-the-blank code puzzle for every lesson.
- **11 independent program challenges**, plus all **seven experiments** from `Downloads/Experiment list.txt` (one trainer orientation and six program labs).
- A browser-only assembly teaching interpreter: Run, Step, registers, flags, editable memory, and simulated output ports.
- XP, levels, practice streaks, milestone badges, per-processor roadmaps, and **seven progress groups**: foundations, instruction families, programming concepts, quiz mastery, guided puzzles, independent programs, and assigned labs.
- Saved code drafts, JSON backup export/import, email/password sign-in, Google sign-in, and account progress merging.
- Responsive desktop/mobile layouts and keyboard-accessible controls.

### Completion and XP

Reading a lesson earns 40 XP, first quiz mastery earns 30 XP (at least 80%; three-question quizzes require 3/3), a correct puzzle earns 35 XP, a program test-case completion earns 75 XP, and a lab earns 100 XP. Repeating a completed checkpoint does not award duplicate XP. One level is 400 XP. A fully mastered lesson includes reading, quiz, puzzle, and its program if assigned. Lab 1 is self-reported orientation.

## Enable cloud saving (one-time Firebase setup)

This is needed for **automatic progress across different devices**. localStorage alone cannot do that. Firebase is a managed backend service; you only host the frontend yourself.

1. Go to [Firebase Console](https://console.firebase.google.com/), create a project, and **register a Web app**.
2. In **Authentication → Sign-in method**, enable **Email/Password** and **Google**. Select a support email for Google sign-in.
3. In **Authentication → Settings → Authorized domains**, add your deployment domain. Add `localhost` for local development if it is not already present.
4. In **Firestore Database**, create the default database. Start in production mode and choose a region.
5. In the Firestore **Rules** tab, paste the contents of **`firestore.rules`** and publish. Those rules permit each authenticated user to access only their own `/users/{uid}` document. Do not use open test-mode rules.
6. Create **`.env.local`** next to `package.json`, using the template `.env.example`:

   ```dotenv
   VITE_FIREBASE_API_KEY=your-web-app-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_APP_ID=your-app-id
   ```

   Find these in Project settings → General → Your apps → SDK setup and configuration. These are Firebase **web client configuration values**, not admin credentials. Never put a service-account private key in the frontend.

7. Restart `npm run dev`. For deployment, add the same `VITE_…` variables to your host's build environment and rebuild. Vite substitutes these values **at build time**.
8. Create/sign in to an account. Wait for **Cloud synced**, then sign in to that same account on another device. Verify that the completed groups and code drafts appear there.

No Cloud Functions or custom server is required. Firebase's available free quotas may be sufficient for personal learning; the service still has quotas, so check your project usage. The client debounces cloud writes by one second.

### Optional Firebase Hosting

`firebase.json` is already provided. With the Firebase CLI installed, use:

```bash
firebase login
firebase use --add
npm run build
firebase deploy --only hosting,firestore:rules
```

### How saving and merge work

- **Guest:** progress is written immediately to this browser's localStorage.
- **Signed in:** each account has its own local save and one private Firestore document. Guest achievements are merged into the account on sign-in, then the guest partition is cleared after a successful local account save.
- **Device synchronization:** Firestore snapshots bring in remote changes. A transaction reads the latest cloud record before merging and writing, avoiding last-write-wins loss of completed milestones.
- **Completed milestones:** combine the IDs from both devices. **Quiz results:** retain the best score. **Code drafts:** the newest timestamp wins. Device clocks should be accurate; simultaneous editing of one program is not a collaborative editor and both conflicting draft versions are not retained.
- **Offline:** changes remain in account-specific browser storage. They retry while the page is open when the network returns. Wait for the confirmed “Cloud synced” label before switching devices. Offline operation means continuing an already-loaded page; there is no service worker to open the site from a cold cache.
- **Signing out:** account data stays under the account's local key and does not appear in the guest session. A pending-sync sign-out confirmation explains where unsynced data remains.
- **Manual transfer:** My progress → Export downloads JSON; Import merges a JSON backup on another device. Import never discards better scores or completed checkpoints.
- **No Firebase configuration:** the website clearly shows device-only saving and explains setup in the account dialog. It does not pretend to be cloud-synced.

## Lab assumptions

Your experiment sheet supplies seven 8085 titles. Missing details are stated in each lab:

- Even/odd source assumed to be the 16-byte block at 2400H; counts at the specified 3000H and 3002H.
- 128-byte pattern interpreted as four complete ascending 16-byte sequences followed by four descending sequences.
- 20-digit BCD uses **unpacked, least-significant-digit-first** inputs in this version, with a 21-byte result. Packed BCD would need a different solution. The lesson explains both formats.
- Descending sort assumes 16 unsigned bytes at 2400H.
- Nibble conversion assumes input at 2400H and high/low ASCII outputs at 3000H/3001H.
- VMC trainer model, memory map, and keypad sequence must be checked with the trainer manual/instructor.

## Interpreter scope

This is an **instruction-level teaching interpreter**, not an opcode assembler or cycle-accurate emulator. It supports the forms used by all provided solutions. The PC/IP display is a logical instruction index; memory contains data, not assembled program bytes. Programs use Intel-style operand order, labels ending in a colon, semicolon comments, decimal numbers, H-suffixed hex, and B-suffixed binary.

Editor drafts are limited to 16,000 characters each to keep the account document within Firestore's size limit.

8085: common data, arithmetic (including DAA), logic, rotations, conditional branches/calls/returns, pair stack operations, and simple port I/O. 8086: general-register/memory data and arithmetic, one-operand multiplication, shifts with 1/CL, signed/unsigned jumps, near calls, word stack operations, and basic REP string copies/loads/stores. Original 8086 addressing and size mismatches are checked.

Hardware interrupts, RIM/SIM, 8085 RST vectors, DOS/BIOS services, far transfers, 8086 decimal adjustment/division/string compare/scan, coprocessor operations, timing, and directives such as ORG/DB/DW are not implemented. These instructions are taught or documented and rejected clearly when execution is unsupported. Undefined flags are not simulated. Program completion checks the supplied output test case; it does not prove correctness for every possible input.

For authoritative instruction details, consult Intel's **8080/8085 Assembly Language Programming Manual** and **The 8086 Family User's Manual** alongside your course notes. MAME's 8085 implementation was consulted to check the complemented auxiliary half-borrow behavior, which differs from 8086 AF.

## Verification

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests run every provided programming solution, exercise arithmetic/flags/segmented addressing/stack behavior, reject invalid forms, and verify progress merging and grouped completion. Browser tests cover the beginner learning loop, lab execution, draft persistence, 8086 practice, backup transfer between separate browser contexts, and mobile navigation. Browser tests assume guest mode (Firebase variables unset). Real cloud sign-in/sync additionally needs a configured Firebase project and two-device verification.

## Extend your course

- `src/data/curriculum.ts`: modules, lesson explanations, quiz questions, puzzles, and program challenges.
- `src/data/instructions.ts`: searchable instruction entries and supported-form markers.
- `src/data/labs.ts`: your experiment guides and memory test contracts.
- `src/lib/simulator.ts`: interpreter behavior and output validation.
- `src/lib/progress.ts`: schema normalization, merge rules, and completion groups.
- `src/context/ProgressContext.tsx`: immediate device saving and Firebase account sync.

Keep lesson IDs stable so existing achievements continue to match. Add future 8086 experiments when you receive that lab sheet.
