# WORLDWORKS: design reference board

Research date: 2026-11-12. Written for the designer (Claude Opus) who will design every screen, and for the user at checkpoint CP1, where one of the three directions in section 7 gets picked.

**What we are designing** (from PLAN.md): a canvas where players drag seven parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal), wire them into money machines, and watch coins flow along the wires as particles. An AI customer walks up and pays. Each machine really runs on NEAR testnet, and the Portal part pays out on Sepolia. "Open as app" turns a machine into a standalone payment page. The judges get 60 seconds with it. It has to read as **playful and premium, never as a crypto dashboard**.

**Markers used below**
- **✅** I opened the page today, or viewed its screenshot or store image.
- **🖼** Image saved in `refs/` (index in section 9).
- **⚠️** From memory or a secondary source; not checked today. Treat it as a hint and check before relying on it.
- **Steal:** the specific thing to copy. **Avoid:** the specific thing not to copy.

---

## 0. The ten rules this board adds up to

1. **Make the flow the hero.** Every reference that makes automation satisfying (Factorio, shapez, Mini Motorways) shows *items moving on paths at a constant, readable speed*. Coins must travel along wires at constant speed. Never teleport them.
2. **One ground colour plus flat, saturated objects.** Mini Motorways, shapez and Townscaper all set calm, desaturated ground against a few bright objects. Money (gold) should be the most saturated thing on screen.
3. **Colour means state, not decoration.** Poly Bridge colours structural stress; Mini Metro gives each line one colour. Use green = confirmed on chain, amber = pending, coral = lost or failed, lilac = the other chain.
4. **Parts are characters.** Game Builder Garage puts tiny faces on its nodes, and Human Resource Machine is staffed by workers. Two dots for eyes is enough to make a Vault look worried when it is empty.
5. **IN on the left, OUT on the right.** Human Resource Machine's IN/OUT conveyors and Stripe's swimlanes both make direction obvious. The customer enters from the left; payouts leave on the right.
6. **Numbers are tabular, animated and honest.** Use a monospaced, rolling counter (Sablier, Superfluid, the live counter on Stripe's homepage). Every on-chain number links to an explorer.
7. **Show the rule in plain words.** Stripe's flow-of-funds diagrams label every box "$10 Charge", "$1.23 Application fee". The Splitter shows "70% → Vault · 30% → You", not a percentage slider alone.
8. **Hide the chain until it is a payoff.** Family, Daimo and Splits never lead with chains or addresses. The cross-chain payout is shown once, as a celebratory moment, with the explorer link as proof.
9. **Sound is half the "satisfying".** Bruno Simon's site ships Howler audio (✅). A coin clink per part, a register "ka-ching" on payout, and a mute toggle.
10. **Restraint makes it premium.** At most three typefaces, one radius scale, one shadow direction, and nothing idle-animating except the customer.

---

## 1. Construction and automation games: how flows and machines become legible

| # | Reference | What to steal | Image |
|---|---|---|---|
| 1.1 | **Mini Motorways**, Dinosaur Polo Club. ✅ https://store.steampowered.com/app/1127500/ · https://dinopoloclub.com | **Steal the whole look for Direction A.** One flat ground colour per map (orange, cream, near-black), roads as thick round-capped dark strokes, buildings as rounded squares with a hard drop shadow and two tiny "eyes". A highlighted route is drawn as a translucent orange ribbon *over* the road; copy that for "the path a coin will take" while dragging a Splitter. The HUD is just small round icon buttons at the bottom centre. | 🖼 `refs/mini-motorways_orange.jpg`, `refs/mini-motorways_dark.jpg` |
| 1.2 | **Mini Metro**, Dinosaur Polo Club. ✅ https://store.steampowered.com/app/287980/ | One colour per line, stations as hollow shapes, a paper-white ground, and a colour palette of available lines as dots at the bottom (the dots double as inventory). Copy the dot row as the **parts tray count** ("3 Splitters left"). ⚠️ Its procedural audio, where each event plays a note, is the model for coin sounds (from memory). | 🖼 `refs/mini-metro_lines.jpg` |
| 1.3 | **shapez** (1), tobspr Games. ✅ https://store.steampowered.com/app/1318690/ · https://shapez.io | Light grey grid ground, light grey belts with **items visible on them as coloured dots**, dark grey machines. The central hub shows "DELIVER 18 / TO UNLOCK" as a big counter on the building itself. Copy the **goal counter painted on the main part** (for example, the Vault shows "reserve 4.2 / 10 NEAR"). | 🖼 `refs/shapez_hub.jpg`, `refs/shapez_belts.jpg` |
| 1.4 | **shapez 2**, tobspr Games. ✅ https://store.steampowered.com/app/2162800/ · https://shapez2.com | Machines have **bright orange "frames" around a neutral body**, so the active ingredient (a glowing blue core) pops. In the overview shot, the selected production line is **re-tinted neon green while everything else stays neutral**. Copy that as "hover a wire, highlight the whole downstream path". | 🖼 `refs/shapez2_machines.jpg`, `refs/shapez2_highlight.jpg` |
| 1.5 | **Factorio**, Wube. ✅ https://store.steampowered.com/app/427520/ · https://factorio.com | Density proves the belts work: items stay readable on belts even at scale. Steal the **colour-coded pipes and wires** (red and green circuit wires drawn over machines). **Avoid** its brown industrial palette and visual noise; it is the opposite of a 60-second read. ⚠️ Its "alt mode" overlay, which shows each machine's recipe icon, is a good model for a "show rules" toggle (from memory). | 🖼 `refs/factorio_belts.jpg` |
| 1.6 | **Opus Magnum**, Zachtronics. ✅ https://store.steampowered.com/app/558990/ · https://www.zachtronics.com/opus-magnum/ | Parts sit on a **teal hex board**; the left rail holds the parts palette, and a **timeline of instructions runs along the bottom**. Its outputs are long satisfying chains of finished products. Steal the left parts rail with large part icons and the idea that the finished machine **loops visibly**. ⚠️ It exports a GIF of your solution (from memory); "share a GIF of my machine" would be a strong stretch goal. | 🖼 `refs/opus-magnum_machine.jpg`, `refs/opus-magnum_timeline.jpg` |
| 1.7 | **Human Resource Machine**, Tomorrow Corporation. ✅ https://store.steampowered.com/app/375820/ · https://tomorrowcorporation.com/humanresourcemachine | **IN conveyor on the left wall, OUT conveyor on the right, a worker in the middle.** The program is a stack of coloured command chips (inbox, copyto, add, outbox) with **curved jump arrows** in the margin. Copy IN/OUT for the customer and payouts, and the command chip style for **rule chips on Gates** ("min 1 NEAR"). | 🖼 `refs/human-resource-machine.jpg` |
| 1.8 | **7 Billion Humans**, Tomorrow Corporation. ✅ https://store.steampowered.com/app/792100/ | Same chip language, plus **many identical workers in a row each holding a number**, and hand-lettered "GO!" / "DONE" stamps in the program margin. Steal the **hand-stamped state words** for machine run states (RUNNING / PAID / BROKE). | 🖼 `refs/7-billion-humans.jpg` |
| 1.9 | **Poly Bridge**, Dry Cactus. ✅ https://store.steampowered.com/app/367450/ | The build view is a flat grey grid with **joints as yellow dots, anchors red, members coloured by stress**. Steal stress-colouring for **wire health**: a wire tints from green to coral as the Vault it feeds drains. | 🖼 `refs/poly-bridge_stress.jpg` |
| 1.10 | **ISLANDERS**, Grizzly Games. ✅ https://store.steampowered.com/app/1046030/ | The best minimal game HUD here: a **circular score ring bottom-left ("262/320")** and a **single pill tray of building cards** at bottom centre. Copy the ring as the machine's **profit/loss gauge**, and the pill tray as the parts palette for a bottom-dock layout. | 🖼 `refs/islanders_hud.jpg` |
| 1.11 | **Townscaper**, Oskar Stålberg. ✅ https://store.steampowered.com/app/1291340/ | Saturated pastel blocks against a foggy teal sea: proof that **a desaturated background plus candy-coloured objects reads premium**. Its click-to-place satisfaction, where blocks pop in and adapt to neighbours, is the feel to aim for when dropping a part on a wire. | 🖼 `refs/townscaper.jpg` |
| 1.12 | **Dorfromantik**, Toukana. ✅ https://store.steampowered.com/app/1455840/ | Soft pink sky ground, ghosted hex slots showing where a tile can go, and the **next tiles as a physical stack bottom-right with a count**. Copy the **ghost slots**: when dragging a part, show translucent sockets on wires where it can snap. | 🖼 `refs/dorfromantik.jpg` |
| 1.13 | **Infinifactory**, Zachtronics. ✅ https://store.steampowered.com/app/300570/ | Chunky navy blocks with **orange accent edges** on a factory floor. Mostly a palette reference for an industrial version (navy plus safety orange). Lower priority. | 🖼 `refs/infinifactory.jpg` |
| 1.14 | **Satisfactory**, Coffee Stain. ✅ https://store.steampowered.com/app/526870/ (store page only; no image saved) | Its blueprint/build UI is a dark radial grid of icon buttons. Mainly an example of **what not to do in 2D**: too much 3D realism for a 60-second read. | link only |

**Bonus (Nintendo):** **Game Builder Garage**, Nintendo. ✅ https://www.nintendo.com/us/store/products/game-builder-garage-switch/
- What it is: a node-based programming game. Nodes ("Nodons") are coloured cards with a **little character face perched on top**, input/output ports are labelled, and wires are thick magenta curves on a **bright yellow grid**. The bottom tab bar is colour-coded (Input / Middle / Output / Objects), and a speech-bubble tutor explains: "Then link up the Button Nodon's output port to the Person Nodon's jump port."
- Steal: **(a)** part faces, **(b)** palette tabs colour-coded by part family, **(c)** the tutor speech bubble for the 10-second "your machine is losing money" opening.
- Images: 🖼 `refs/game-builder-garage_nodes.jpg`, `refs/game-builder-garage_tutorial.jpg`
- Its predecessor, Nintendo Labo's Toy-Con Garage, connected input nodes to output nodes by drawing lines on the touchscreen ✅ (https://en.wikipedia.org/wiki/Nintendo_Labo).

---

## 2. Node and wire editors with great feel

| # | Reference | What to steal | Image |
|---|---|---|---|
| 2.1 | **React Flow / xyflow** ✅ https://reactflow.dev · examples ✅ https://reactflow.dev/examples | The homepage hero is the pattern: **white cards with small headers, grey dashed bezier wires, one bright magenta accent**, and a live output node. The examples library has, ready to copy: **Drag and Drop** from a sidebar (`/examples/interaction/drag-and-drop`), **Validation** of connections (`/examples/interaction/validation`), **Prevent Cycles** (`/examples/interaction/prevent-cycles`), **Connection Limit** (`/examples/nodes/connection-limit`), and **Animating Edges** (`/examples/edges/animating-edges`), which moves an SVG element along the edge with `<animateMotion>` or animates a node along `offsetPath`/`offsetDistance`. These map almost one-to-one to our coin-on-wire and bad-graph rejection. | 🖼 `refs/reactflow_home.jpg` |
| 2.2 | **cables.gl** ✅ https://cables.gl | Dark patching UI: **thin coloured cables whose colour encodes data type**, with the live WebGL output beside the patch. Steal type-coloured wires: NEAR coins gold, ETH/Portal lilac, Worker approval signals a thin dashed white. | 🖼 `refs/cables_og.jpg` |
| 2.3 | **natto.dev** ✅ https://natto.dev | A JavaScript canvas whose og image is **cream paper, thin terracotta line drawing and monospace type**. Steal the warm-paper canvas plus monospace labels as an alternative to the blueprint cliché. | link (og image is just a logo) |
| 2.4 | **FigJam** connectors ✅ https://www.figma.com/figjam/ | Brand art is **pink ground, chunky flat shapes, a squiggly hand-drawn arrow and a smiley sticker**. Steal the **hand-drawn arrow** for onboarding hints ("drag a Splitter here →"). ⚠️ Connectors snap to object edges and reroute when objects move (from memory). | 🖼 `refs/figjam_og.jpg` |
| 2.5 | **tldraw SDK** ✅ https://tldraw.dev | Great *feel*: arrows bind to shapes, with fast and forgiving hit areas (⚠️ binding behaviour from memory). Steal the **generous hit targets and the hand-drawn arrow tips**. **Do not build on it** (see section 6: licence). | link |
| 2.6 | **Unreal Engine Blueprints** ✅ (page exists) https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprints-visual-scripting-in-unreal-engine | ⚠️ From memory: **white "execution" wires vs coloured data wires**, and pins whose shape shows the type (triangle for execution, circle for data). Steal a distinct port shape for "money" vs "permission" (Worker → Gate). | link |
| 2.7 | **Blender Geometry Nodes** ⚠️ https://docs.blender.org/manual/en/latest/modeling/geometry_nodes/introduction.html (manual page loaded; the blender.org features page blocked the bot) | ⚠️ From memory: **node header colour by category**, inline field values inside nodes, and dashed wires for "field" (lazy) values. Steal header-by-category and dashed-for-pending. | link |
| 2.8 | **Houdini** (SideFX) ✅ site https://www.sidefx.com · **TouchDesigner** (Derivative) ✅ https://derivative.ca | ⚠️ From memory: TouchDesigner shows a **live preview thumbnail inside every operator**. Steal it: every part shows its live balance inside the block. | link |
| 2.9 | **Rete.js** ✅ https://rete.js.org | An alternative framework (MIT, v2.0.6). Noted only as a fallback to React Flow; no visual to steal. | link |

---

## 3. Playful premium web

| # | Reference | What to steal | Image |
|---|---|---|---|
| 3.1 | **Bruno Simon's portfolio (2025 version)** ✅ https://bruno-simon.com | You drive a toy car through a warm, low-poly, sunset-lit world. The page lists Three.js (WebGL and WebGPU via TSL), Rapier physics, **Howler.js audio** and Blender assets, with the code on GitHub under MIT. Typefaces: **Amatic SC + Nunito**. Steal **warm, single-light-direction colour grading** and **sound as a default part of a playful site**. Do not attempt 3D in 2 days. | 🖼 `refs/bruno-simon_og.jpg` |
| 3.2 | **neal.fun, "Spend Bill Gates' Money"** ✅ via search (the site blocked the headless browser, so no screenshot) https://neal.fun/spend/ | The model for a money toy: **a giant sticky balance counter at the top that changes the instant you click Buy**, over a grid of simple item cards. Steal the **instant, oversized counter feedback** for the Vault and the customer's purchase. | link |
| 3.3 | **Stripe homepage** ✅ https://stripe.com | A **live-ticking metric line above the headline** ("Global GDP running on Stripe: 1.74851679%"), a **two-tone headline** (dark first sentence, lighter blue continuation) and a diagonal **multi-colour silk-ribbon gradient** bleeding off the right edge. Steal the ticking stat (for example "NEAR moved by machines today: 12.4031") and the two-tone headline. **Avoid** copying the ribbon; it is Stripe's signature. | 🖼 `refs/stripe_home.jpg` |
| 3.4 | **Stripe Sessions** ✅ https://stripe.com/sessions and **Stripe Press** ✅ https://press.stripe.com | Sessions 2027 og art: **huge tight sans on a vivid fluid gradient**. Stripe Press: **black ground, single gold monogram**, bookish. ⚠️ Press's book-cover grid from memory. Steal Press's restraint for the "Open as app" page (one colour, one mark, generous whitespace). | link |
| 3.5 | **Linear** ✅ https://linear.app | Near-black page, **big white medium-weight headline left-aligned**, a product screenshot framed with barely visible chrome. Steal for the landing pitch and dark mode: **contrast through type weight, not colour**. | 🖼 `refs/linear_home.jpg` |
| 3.6 | **Teenage Engineering OP–1 field** ✅ https://teenage.engineering/products/op-1 | A product photo on flat light grey with **coloured knobs as the only colour**. Copy is **lowercase and conversational** ("if it feels thinner. it is."), feature lists in ALL CAPS, en-dash product names. The footer links a press page at /press. Steal **one or two saturated accents on a calm neutral body** and **lowercase micro-copy** for part descriptions ("splitter. sends some here, some there."). | 🖼 `refs/te_op1-field.jpg` |
| 3.7 | **Family** (wallet) ✅ https://family.co | **Big friendly black headline left, pastel puffy 3D-ish icons right** (wallet, heart, lock, a blue blob with two eyes). Its copy promises "seamless animations between states" for transaction status and "Delightful interactions with every tap". Steal **state-to-state transaction animation** (pending → confirmed) and the **blob-with-eyes mascot energy**. | 🖼 `refs/family_og.jpg` |
| 3.8 | **Rive** ✅ https://rive.app (the old /community URL now redirects to a "Marketplace") | The hero claims interactive state machines for UI. Useful as an *idea* (part characters with state-machine expressions), but see the Rive row in section 6 for the 2-day risk. | link |
| 3.9 | **Arc browser marketing** ✅ https://arc.net | **Now a farewell page**: "Arc is sunsetting on December 22, 2026" and users are moved to Dia. Don't use it as a live reference; judges may know it is shutting down. | link |
| 3.10 | **Pitch** ✅ https://pitch.com | The og image is a purple gradient with a white wordmark. Nothing specific to steal; listed because the brief asked. | link |

---

## 4. Money-flow visualization

| # | Reference | What to steal | Image |
|---|---|---|---|
| 4.1 | **Stripe Connect flow-of-funds diagrams** ✅ https://docs.stripe.com/connect/collecting-fees (also /connect/charges, /connect/application-fees) | **Two pale swimlanes ("Platform account" / "Connected account"), each a vertical stack of white ledger cards ("$10 Charge" → "$10 Transfer" → "$1.23 Application fee" → "$0.64 net") with thin arrows that cross lanes.** This is the **Ledger drawer** design: one lane per account (Customer, Machine, Vault, You, Sepolia), each transaction a card, arrows between lanes, and an explorer link on each card. | 🖼 `refs/stripe_connect-fee-flow.jpg` |
| 4.2 | **Monarch Money Cash Flow Sankey** ✅ https://www.monarch.com/blog/visualize-your-cash-flow-like-never-before · help ✅ https://help.monarch.com/hc/en-us/articles/20504904768020-Cash-Flow | Income bars on the left, a single total bar, then **pastel ribbons fanning out to categories, each ribbon tinted by its destination**, with amounts labelled at the node ends. Steal it for a **"where did 1 NEAR go" mini Sankey** in the ledger or app page. | 🖼 `refs/monarch_sankey.jpg` |
| 4.3 | **SankeyMATIC** ✅ https://sankeymatic.com/build/ | A free builder with text syntax (`Wages [1500] Budget`). Use it to **prototype the machine's Sankey in minutes** before coding; d3-sankey (section 6) renders the real one. | link |
| 4.4 | **Monzo Salary Sorter** ✅ https://monzo.com/i/salary-sorter/ · ✅ https://monzo.com/blog/2019/09/26/introducing-salary-sorter-and-bills-pots/ | A consumer **splitter**: an incoming payment is split into Pots, with the remainder left in the main balance. Steal the **mental model and wording**: "When money comes in, send X to Bills, Y to Savings". Our Splitter's plain-language label should read like this. Monzo's hot-coral brand (✅ og image) shows coral can be friendly, not alarming. | link |
| 4.5 | **Splits** ✅ https://splits.org · app og ✅ | **A big balance "$675,461.79" with the cents de-emphasised, and directly beneath it a thin segmented allocation bar (USD / ETH / BTC) with a dot legend.** This is the Splitter's percentage display and the app page's balance block. | 🖼 `refs/splits_app_og.jpg`, `refs/splits_home.jpg` |
| 4.6 | **Sablier** (token streaming) ✅ https://sablier.com | A **circular progress arc around a huge monospaced streaming number "615422.3425"**, with the decimals in a lighter weight. Steal it for the **Vault gauge** (reserve vs target) and any streaming counter. | 🖼 `refs/sablier_og.jpg` |
| 4.7 | **Superfluid** ✅ https://superfluid.org | "Earn **every second**" (second line in lime). The brand concept is money as a continuously flowing liquid, rendered as a green liquid ribbon. Steal **per-second ticking balances** while coins are flowing. | 🖼 `refs/superfluid_og.jpg` |
| 4.8 | **Ramp** ✅ https://ramp.com · **Mercury** ✅ https://mercury.com | Ramp: a black card, chips for amounts ("$63.23", "¥8,973") and a **stacked-area chart in black/orange/teal/navy**. Mercury: a calm dark dashboard and soft gradient hero. Steal Ramp's **amount chips** for coin tooltips; Mercury only as Direction B's dark-UI calibration. | 🖼 `refs/ramp_og.jpg`, `refs/mercury_og.jpg` |

---

## 5. Crypto products that hide the chain well

| # | Reference | What to steal | Image |
|---|---|---|---|
| 5.1 | **Daimo** ✅ https://daimo.com | Light, almost no colour except one green; a **dotted globe with a flag pin**, and a phone showing a **"Deposit" sheet with three plain rows (Bank / Coinbase / Other) and "Powered by Daimo"**. Steal it for the **"Open as app" payment page**: one card, plain-language rows, the brand in small type at the bottom, no chain names. | 🖼 `refs/daimo_home.jpg` |
| 5.2 | **Splits** ✅ (see 4.5) | Addresses are shown **shortened and grey next to human names ("Treasury 0x9946…17a1")**. Copy that exact pattern: human label first, short address in grey mono second. | 🖼 |
| 5.3 | **Family** ✅ (see 3.7) | It sells "Your favorite crypto wallet" with joy, not charts. Human-readable activity and animated status transitions. | 🖼 |
| 5.4 | **Peanut** (payment links) ✅ via search: https://peanutprotocol.gitbook.io/peanut-protocol-docs-1/learn/how-to-use-peanut-links/how-do-peanut-links-work | Payments as **shareable links** (`peanut.me/<name>@<chain>/10usdc`); users "don't need to deal with wallet addresses and chain preferences". Steal it for "Open as app": the URL is the product, so show `/m/<machine>` big, with a copy button and QR. | link |
| 5.5 | **Rainbow** ✅ https://rainbow.me | Glossy rainbow app icon, dark cards, rounded tiles. Shows how to be **colourful in crypto without neon**; but its current "trade any market" ticker grid is exactly the dashboard trope to avoid (see list below). | 🖼 `refs/rainbow_og.jpg` |
| 5.6 | **NEAR brand (near.org)** ✅ https://near.org | The site CSS uses **#00EC97 (NEAR green), #F2F1E9 (warm off-white), #191919, #17D9D4 (cyan), #9797FF (lilac), #FF7966 (coral), #FFE02A (yellow)** (extracted from near.org's stylesheet today). Page title: "NEAR: The Currency of Agents". Use **#00EC97 as our "confirmed on NEAR" colour** so the founder sees his brand on success states. Third-party colorfyi lists #00C08B (⚠️ older value). | 🖼 `refs/near_og.jpg` |
| 5.7 | **Phantom** ✅ https://phantom.com | Lavender ground, white ghost mascot: one mascot shape, one colour. A reminder that **a single friendly mascot beats a token-logo collage**. | link |
| 5.8 | **Coinbase Wallet / Base app** ✅ https://base.app · **Privy** ✅ https://www.privy.io | Both sell embedded wallets, where the user never sees a seed phrase. Relevant to our "no wallet, browser key, sponsored gas" landing; nothing visual to steal. | link |

### Do not look like this (generic crypto dashboard tropes)
- **Black with purple-to-cyan neon gradients**, glowing hexagons, laser grids, or space and astronaut imagery.
- A **"Connect Wallet" button as the hero CTA**, or a chain-selector dropdown full of token logos in the header.
- **Candlestick charts, red/green tickers and percent-change pills** anywhere in the product (Rainbow's og image is exactly this).
- **Walls of full hex addresses and tx hashes.** Show `name · 0x12…ab` and put the full value behind a copy or explorer link.
- **TVL / APY / "Total Value Locked" stat bars** across the top.
- **Stock 3D coins, rockets, diamond hands, robots.** Our coins are simple flat gold discs.
- **Orbitron, Audiowide and other "tech" display fonts**; all-caps tracking-wide headers everywhere.
- **Glassmorphism card stacks** with heavy blur on a gradient blob background.
- **Gas or network-fee modal interruptions.** Gas is sponsored; never show a fee dialog in the demo path.
- **Fake precision** (18-decimal numbers). Show 2–4 decimals and the rest in a tooltip.

---

## 6. Front-end building blocks (versions from the npm registry, 2026-11-12)

| Library | Version | Licence | Use it for | 2-day fit |
|---|---|---|---|---|
| **@xyflow/react** (React Flow) | 12.12.1 | MIT | Canvas, pan/zoom, drag from sidebar, ports, edge validation, cycle prevention | **Yes, the core.** Custom nodes are plain React/SVG, so any of the three skins works. |
| **motion** (formerly framer-motion; `framer-motion` is also 14.13.0) | 14.13.0 | MIT | Springs on part drop, drawer, layout transitions, number roll | **Yes** |
| **howler** | 2.2.4 (last release 2023-09; stable) | MIT | Sound sprites, mute, mobile unlock | **Yes** (Bruno Simon's site uses it ✅) |
| **Kenney "Interface Sounds"** | 100 files | CC0 ✅ https://kenney.nl/assets/interface-sounds | Clicks, snaps, confirms | **Yes.** ⚠️ Look for a coin "clink" in Kenney's other audio packs (not verified). |
| **d3-sankey** | 0.12.3 | BSD-3-Clause | "Where did the money go" Sankey in ledger or app page | **Yes**, small |
| **canvas-confetti** | 1.9.4 | ISC | One burst on cross-chain confirm | **Yes** |
| **zustand** | 5.1.0 | MIT | Graph, run and ledger state | **Yes** |
| **pixi.js** + **@pixi/react** | 8.23.0 / 8.0.5 | MIT | Particle layer when there are more than ~200 coins at once | **Maybe.** Start with SVG or a single canvas overlay; switch to Pixi only if the frame rate drops. |
| **gsap** | 3.15.1 | GSAP Standard "no charge" licence: all plugins (MotionPath, MorphSVG…) free for commercial use since 2025-04-30 (Webflow) ✅ https://webflow.com/blog/gsap-becomes-free | Scripted 60-second intro timeline, MotionPath along SVG wires | **Maybe**; pick Motion *or* GSAP, not both. The licence restricts use in no-code visual animation tools that compete with Webflow, which does not apply to us. |
| **tone** | 15.1.22 | MIT | Generative pentatonic coin plinks (Direction B/C) | Optional |
| **@rive-app/react-canvas** | 4.39.0 | MIT runtime; editor Free plan **exports with a Rive splash screen**, and removing it needs a paid plan ✅ https://rive.app/pricing | Part characters with state machines | **Risky.** Learning curve plus splash. Skip. |
| **lottie-web** / **@lottiefiles/dotlottie-react** | 5.13.0 / 0.22.2 | MIT (each LottieFiles asset has its own licence) | One premade "success" animation | Optional |
| **three** + **@react-three/fiber** + **drei** | 0.187.0 / 9.8.2 / 10.7.9 | MIT | 3D diorama landing | **No** for 2 days |
| **tldraw** | 5.6.0 | Own licence: "commercial license for production use", 100-day trial, a separate hobby licence ✅ https://tldraw.dev/pricing | | **No.** Licence friction, and it is a whiteboard, not a typed node graph. |
| **rete** | 2.0.6 | MIT | Alternative node editor | No; React Flow has more examples |
| **matter-js** | 0.20.0 | MIT | Physical coin pile inside the Vault | Stretch only |

**Recommended stack:** React Flow + custom SVG nodes/edges, coins as SVG circles animated with `getPointAtLength`/`offset-path` (or a canvas overlay), Motion for UI, Howler + Kenney CC0 for sound, d3-sankey for the ledger, canvas-confetti for the Portal moment. Every visual direction below runs on this same stack, so the visual direction can be changed late without re-engineering.

### Fonts (all confirmed served by Google Fonts today)
Fredoka, Nunito, Bricolage Grotesque, Baloo 2, Geist, Geist Mono, Inter Tight, Instrument Serif, JetBrains Mono, Pixelify Sans, Silkscreen, VT323, Space Mono, Space Grotesk, DM Sans, Sora, IBM Plex Mono, Press Start 2P, Lilita One, Recursive. (Departure Mono is *not* on Google Fonts; it has its own site.)

---

## 7. Three visual directions

### Direction A: "Toy Works" (warm toy-factory tabletop, top-down 2.5D) ★ RECOMMENDED

**Mood.** A sunny tabletop where money machines are built from chunky rounded toy blocks on warm paper, joined by fat dark "pipes" like Mini Motorways roads. Coins are fat gold discs that roll along the pipes at an even pace and *clink* into each part. Every part has two dot-eyes and a tiny personality: the Vault looks worried when it runs low, the Gate's boom arm lifts, and the Worker holds a key. The customer is a small round character who walks in on the left IN belt; payouts leave on the right OUT belt. Anything confirmed on NEAR gets a green "stamp" pop with an explorer link. The Portal is the only lilac thing on the board, a swirling ring that sends a coin "elsewhere" and comes back with a Sepolia receipt. Premium comes from restraint: one ground colour, flat fills, one hard shadow direction and immaculate type. Playfulness comes from motion and sound.

**Palette**

| Role | Hex |
|---|---|
| Ground (paper) | `#F4EEE3` |
| Ground dot grid | `#E4DACA` |
| Ink | `#24203A` |
| Ink secondary | `#6B6680` |
| Pipe / wire | `#36314D` |
| Pipe inner stripe | `#4A4466` |
| Coin | `#FFC53D` with rim `#E39A17` |
| Part family: Input (Coin Slot) | `#FFB547` |
| Part family: Logic (Splitter, Gate) | `#17D9D4` |
| Part family: Storage (Vault) | `#7C83A6` |
| Part family: Crew (Worker) | `#FFE02A` |
| Part family: Output (Payout) | `#00EC97` |
| Portal / Sepolia | `#9797FF` |
| Confirmed | `#00EC97` (NEAR green) |
| Pending | `#FFB547` |
| Loss / failed | `#FF7966` |

Block shadows are the block colour darkened about 25%, offset 0/6px, with no blur. Logic, Output, Portal, Confirmed and Loss use NEAR's own site colours.

**Type.** **Bricolage Grotesque** 700/800 for display ("Your machine is losing money."); **Nunito** 600/800 for UI and part labels (its rounded terminals match the blocks; Bruno Simon also uses Nunito); **JetBrains Mono** 500 with tabular numbers for amounts and short addresses.

**Shape language.** 8px grid. Parts are 96×96 rounded squares (radius 22) with a hard 6px drop shadow. Pipes are 14px wide with round caps and joins, and run only orthogonally with rounded 24px corners, like Mini Motorways rather than bezier spaghetti. Ports are round sockets; a money port has a gold ring and a permission port (Worker → Gate) is a small key-shaped notch. UI chrome is pill buttons and a bottom-centre parts dock in the style of the ISLANDERS tray, with the Mini Metro-style count dots under each part.

**Motion rules**
1. Coins move at a constant 160 px/s along pipes, without easing, and roll (rotate) as they move.
2. A part squashes when a coin enters (scale 1 → 1.08 → 1, 180 ms spring).
3. Dropping a part overshoots and settles (spring, about 300 ms), and shows Dorfromantik-style ghost sockets while dragging.
4. The Splitter visibly alternates coins left and right at the set ratio, and its label reads "70% → Vault · 30% → You".
5. The Vault's fill level eases over 400 ms, and its eyes change at <20%.
6. Pending is a marching dashed outline in amber; confirmed is a green stamp scaling 1.3 → 1 with a small rotation; failed is two quick shakes and turns coral.
7. Nothing idles except the customer's gentle breathing.
8. Under `prefers-reduced-motion`, coins become number tickers on wires.

**Sound.** Kenney CC0 interface clicks for pick-up, snap and connect. Each part plays a soft wooden "tock" when a coin enters, pitched to a pentatonic note per part, so a running machine makes a little melody. A cash-register "ka-ching" plays on Payout. A Portal whoosh and rising two-note chime plays on Sepolia confirm. A mute toggle sits top-right, and audio starts on first interaction.

**Screens**
- **Workshop:** paper tabletop, dock bottom-centre, ISLANDERS-style profit ring bottom-left, tutor speech bubble à la Game Builder Garage.
- **Ledger drawer:** right side, Stripe swimlane cards, with human names first and the short grey address second (Splits).
- **Open as app:** Daimo/Teenage Engineering calm. Off-white page, the machine's mini diagram as a static illustration, rules in lowercase plain words, one big pay button, and `/m/<name>` with copy and QR.
- **Landing:** drops straight into the broken machine.

**Draws from.** Mini Motorways, Game Builder Garage, Human Resource Machine, ISLANDERS, Dorfromantik, Townscaper, Poly Bridge, shapez, Family, Teenage Engineering, Daimo, Stripe Connect diagrams, Splits, NEAR's palette.

**2-day risk: medium.**
- The main cost is drawing seven charming part blocks in SVG. Budget about 45 minutes each: flat shapes, two eyes, one icon. Then the coin-along-orthogonal-pipe animation, which React Flow's `smoothstep` edge path plus `getPointAtLength` solves.
- Avoid true isometric and 3D, which double hit-testing and art cost. The "2.5D" comes only from hard shadows.
- Fallback: if the art is slow, ship faces-only blocks in flat colours; it still reads as a toy.

**Why recommended**
- It is the only direction that is unmistakably *not* a crypto dashboard in the first second.
- Mini Motorways proves flat, top-down and shadowed can look premium.
- It shares 100% of its stack with Direction B.
- It uses NEAR's own colours for success, which the founder will notice.

---

### Direction B: "Night Shift" (clean premium node canvas, dark)

**Mood.** A precise, beautifully lit control room at night. A graphite canvas with a faint dot grid, crisp dark nodes with hairline borders, and wires that **light up as money passes**. Coins are points of warm light with short additive trails, and balances roll like odometers. It feels like Linear meets Opus Magnum: serious, expensive, engineered. Playfulness comes only from the coin light-show, sound and the AI customer's avatar. It looks the most "investor-grade", and it is also the closest to the dashboard look we must avoid, so it needs one bold signature (the glowing flow) to stand apart.

**Palette.** Background `#0B0C10` · canvas dots `#1C1F27` · node `#14161C` · node border `#262A35` · text `#EDEEF0` · muted `#8B90A0` · coin `#FFD24A` · coin trail `#FF9F1C` · confirmed `#00EC97` · Portal/Sepolia `#9797FF` · pending `#FFB020` · failed `#FF5D5D`.

**Type.** **Geist** 400/500/600 for UI; **Geist Mono** for numbers and addresses; **Instrument Serif** italic for one or two narrative headlines ("*Your machine is losing money.*"), which keeps it from feeling like a dev tool.

**Shape language.** 12px radius nodes, 1px borders, a coloured 3px header stripe per part family (Blender-style category colour, ⚠️). Small ring ports, money ports filled gold and permission ports hollow white (Unreal-style pin types, ⚠️). Wires are 2px beziers, dim at rest and brightening proportionally to recent flow.

**Motion rules.** UI transitions are 160–240 ms ease-out. Coins have an additive glow and a 6-frame trail. Wire brightness decays over 1.5 s after the last coin. Numbers roll digit-by-digit. The drawer opens with a spring. The confirm moment is a ring pulse in NEAR green spreading from the part. Nothing bounces.

**Sound.** Minimal and electronic: soft sine plinks per coin (Tone.js, pentatonic), a low sub "thump" on payout, a filtered sweep for the Portal. Quieter than A.

**Draws from.** Linear, React Flow, Opus Magnum, cables.gl, Sablier, Superfluid, Mercury, Stripe homepage (ticking stat), Stripe Connect swimlanes.

**2-day risk: low build risk, high "sameness" risk.** It is the closest to React Flow defaults, so it is fastest to a polished state. But dark plus glow plus mono numbers is one step from "generic crypto dashboard", the explicit anti-goal. Choose it only if time collapses; it is also the natural night mode of Direction A.

---

### Direction C: "Pixel Works" (retro pixel automation)

**Mood.** A 16-bit factory floor seen from above. Conveyor belts with animated chevrons, chunky pixel coins hopping tile to tile, and tiny pixel workers carrying keys. The Coin Slot is literally an arcade coin-op cabinet, and payouts drop out of a slot with a chiptune jingle. A scoreboard in the corner counts profit like an arcade high score. It has nostalgic, Human Resource Machine-meets-early-Factorio charm, with a strong "game" signal for the Games track.

**Palette: Sweetie 16** by GrafxKid ✅ https://lospec.com/palette-list/sweetie-16
- Colours: `#1A1C2C` `#5D275D` `#B13E53` `#EF7D57` `#FFCD75` `#A7F070` `#38B764` `#257179` `#29366F` `#3B5DC9` `#41A6F6` `#73EFF7` `#F4F4F4` `#94B0C2` `#566C86` `#333C57`.
- Mapping: coin `#FFCD75`, confirmed `#38B764`/`#A7F070`, Portal `#41A6F6`, loss `#B13E53`, floor `#333C57`/`#566C86`.
- No licence is stated on the page; credit the author.

**Type.** **Pixelify Sans** for display; **Silkscreen** for small-caps labels; **Space Mono** for body and addresses, because readability matters for the judges. VT323 is optional for the scoreboard.

**Shape language.** 16px tiles at integer scale (×3) with `image-rendering: pixelated`. Belts are tile pieces (straight, corner, split), and parts are 2×2 tile sprites. There is no anti-aliasing and no rounded corners except in pixel steps.

**Motion rules.** Sprites animate in `steps()` at 8–12 fps, while camera and panels stay smooth at 60 fps. Coins hop tile to tile at a fixed tick (like a game step). Confirmation is a pixel "+1" floating up; failure is a red flash for 3 frames.

**Sound.** Chiptune blips: coin pickup, payout jingle, Portal warp. Generate them with an sfxr-style tool (⚠️ check that tool's licence) or Kenney's CC0 packs.

**Draws from.** Human Resource Machine, 7 Billion Humans, Factorio, shapez (belts with visible items), Mini Metro (inventory dots).

**2-day risk: high.** Pixel art for seven parts, belts in every orientation, characters and the customer needs a real pixel artist; code-generated pixel art usually looks cheap. Tile-based belts also fight React Flow's free-form edges, which means custom routing. It reads "indie toy" more than "premium" to crypto investors, and the money seriousness (real testnet, cross-chain) can feel undercut.

---

### Recommendation

**Pick Direction A, "Toy Works".** It is the strongest anti-dashboard signal in the first second, it is proven premium by Mini Motorways and Townscaper, it has the most charm per hour of work (eyes on blocks, sounds, the walking customer), and it puts NEAR's own green on every success state. Direction B is the safety net: same stack, swap tokens, done in about an hour. Avoid C unless a pixel artist joins.

---

## 8. Part-by-part visual brief (applies to any direction)

| Part | Metaphor | Live readout inside the part | Signature motion |
|---|---|---|---|
| Coin Slot | Arcade coin slot / tip jar with a slot on top | "1.0 NEAR / buy" | Slot glows when a customer approaches; coin drops in with a clink |
| Splitter | Y-junction with a dial; the dial face is a 2-colour pie | "70 / 30" plus a Splits-style segmented bar | A flap flips left/right per coin at the ratio |
| Vault | Squat safe with a window showing a fill level | Sablier-style arc gauge "4.20 / 10" | Fill rises; worried eyes below 20% |
| Gate | Boom barrier with an HRM-style rule chip ("min 1 NEAR" / "needs Worker") | Rule chip | Arm lifts (pass) or shakes (reject, coin bounces back) |
| Worker | Little character holding a key (scoped key) | "can: approve" | Nods and the key glints when approving; a dashed permission wire pulses to the Gate |
| Payout | Spout or chute into a recipient avatar | Recipient name plus short address | Coin pops into the avatar; "ka-ching" |
| Portal | Swirling lilac ring (the only lilac thing) | "→ Sepolia · cap 0.001 ETH" | Coin shrinks into the ring; pending orbit; on confirm, a lilac burst plus confetti and the Sepolia explorer link |

---

## 9. Image index (38 files, 2.5 MB total, every file under 200 KB)

All images are store screenshots (Steam, Nintendo eShop), the product's own og/share image, or a screenshot of the product's own public homepage taken on 2026-11-12. They are reduced to ≤1000 px wide JPEG for internal reference only; do not ship them in the product or the public repo.

| File | Page | Exact image source |
|---|---|---|
| `refs/factorio_belts.jpg` | https://store.steampowered.com/app/427520/ | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/427520/ss_192864c00fc38b5ef97b97ca7fa655a9aed7c0da.1920x1080.jpg |
| `refs/shapez_hub.jpg` | https://store.steampowered.com/app/1318690/ | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1318690/ss_ee76fa2e3259ab077b8a711b394cf6668d4ec93a.1920x1080.jpg |
| `refs/shapez_belts.jpg` | https://store.steampowered.com/app/1318690/ | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1318690/ss_72e11e9a4f32d1f9d464322698a29f8d8e3cd610.1920x1080.jpg |
| `refs/shapez2_machines.jpg` | https://store.steampowered.com/app/2162800/ | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2162800/ec7e9bd126c7c18cb01226c1ef9d9adaa0e20a9b/ss_ec7e9bd126c7c18cb01226c1ef9d9adaa0e20a9b.1920x1080.jpg |
| `refs/shapez2_highlight.jpg` | https://store.steampowered.com/app/2162800/ | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2162800/af77852cd55b1f86d66492d9b109c374c0644ea8/ss_af77852cd55b1f86d66492d9b109c374c0644ea8.1920x1080.jpg |
| `refs/opus-magnum_machine.jpg` | https://store.steampowered.com/app/558990/ | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/558990/ss_e395f88a023ad623f64a622d343eee17e1e6ea9d.1920x1080.jpg |
| `refs/opus-magnum_timeline.jpg` | https://store.steampowered.com/app/558990/ | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/558990/ss_0e35cab840c52b9d39b988d0b0c96b8fe9117264.1920x1080.jpg |
| `refs/mini-motorways_orange.jpg` | https://store.steampowered.com/app/1127500/ | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1127500/ss_7a57d11fd0d3a097b02645f96b49f81793b6ac7f.1920x1080.jpg |
| `refs/mini-motorways_dark.jpg` | https://store.steampowered.com/app/1127500/ | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1127500/d34e19a7ab782516e7cfba7b01daaf02b8388e27/ss_d34e19a7ab782516e7cfba7b01daaf02b8388e27.1920x1080.jpg |
| `refs/mini-metro_lines.jpg` | https://store.steampowered.com/app/287980/ | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/287980/ss_c7bc5df7e606504709e9f53ff9c7584ac4c01b18.1920x1080.jpg |
| `refs/townscaper.jpg` | https://store.steampowered.com/app/1291340/ | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1291340/ss_989ff1808d9416c7b22da3e16ee54874697b1cea.1920x1080.jpg |
| `refs/dorfromantik.jpg` | https://store.steampowered.com/app/1455840/ | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1455840/ss_a49e5fcc5301e8a05a1da7ce233a5377cf680e98.1920x1080.jpg |
| `refs/islanders_hud.jpg` | https://store.steampowered.com/app/1046030/ | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1046030/ss_8c62b14de6d60916ff35a50000596bff79fadd71.1920x1080.jpg |
| `refs/poly-bridge_stress.jpg` | https://store.steampowered.com/app/367450/ | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/367450/ss_41be75d110af3553a634db07d3d670c175e3a86f.1920x1080.jpg |
| `refs/human-resource-machine.jpg` | https://store.steampowered.com/app/375820/ | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/375820/ss_5de238ca62f67dc97c940bd6af61c03a4320c981.1920x1080.jpg |
| `refs/7-billion-humans.jpg` | https://store.steampowered.com/app/792100/ | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/792100/ss_27b3fe9595f1dbe7313d1bcaf883d092912bf243.1920x1080.jpg |
| `refs/infinifactory.jpg` | https://store.steampowered.com/app/300570/ | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/300570/ss_b5dc8cd012171e5b404e9c52cb5cd5eaafe41a8f.1920x1080.jpg |
| `refs/game-builder-garage_nodes.jpg` | https://www.nintendo.com/us/store/products/game-builder-garage-switch/ | https://assets.nintendo.com/image/upload/c_fill,w_800/q_auto/f_jpg/store/software/switch/70010000041267/a638f5cafe20bc2869d8275a3a7a2260c1ae4792d146b02a66a19049711ead3a |
| `refs/game-builder-garage_tutorial.jpg` | https://www.nintendo.com/us/store/products/game-builder-garage-switch/ | https://assets.nintendo.com/image/upload/c_fill,w_800/q_auto/f_jpg/store/software/switch/70010000041267/7d557f603e9098e20a084ff6dbfa4f91a7705af376aebe71a8ea617b8e7e76a0 |
| `refs/bruno-simon_og.jpg` | https://bruno-simon.com | https://bruno-simon.com/social/share-image.png |
| `refs/family_og.jpg` | https://family.co | https://family.co/preview.png |
| `refs/te_op1-field.jpg` | https://teenage.engineering/products/op-1 | https://assets.teenage.engineering/_img/6509496bb045b1bd68c0375b_1024.webp |
| `refs/reactflow_home.jpg` | https://reactflow.dev | homepage screenshot, 2026-11-12 |
| `refs/cables_og.jpg` | https://cables.gl | https://cables.gl/img/metathumb-landing.jpg |
| `refs/figjam_og.jpg` | https://www.figma.com/figjam/ | https://cdn.sanity.io/images/599r6htc/regionalized/f17d3078c6c170d8395dd57aab930b84e88fa6e1-2400x1260.png |
| `refs/stripe_home.jpg` | https://stripe.com | homepage screenshot, 2026-11-12 |
| `refs/stripe_connect-fee-flow.jpg` | https://docs.stripe.com/connect/collecting-fees | https://b.stripecdn.com/docs-statics-srv/assets/application_fee_amount.837aa2339469b3c1a4319672971c1367.svg (rendered to raster) |
| `refs/monarch_sankey.jpg` | https://www.monarch.com/blog/visualize-your-cash-flow-like-never-before | https://cdn.sanity.io/images/mdewiujj/production/f000ac41bae7bb8b6ad554b2124b3c5ac587787d-2400x1350.png |
| `refs/splits_app_og.jpg` | https://splits.org | https://app.splits.org/og-unfurl.png |
| `refs/splits_home.jpg` | https://splits.org | homepage screenshot, 2026-11-12 |
| `refs/sablier_og.jpg` | https://sablier.com | https://sablier.com/opengraph-image.jpg |
| `refs/ramp_og.jpg` | https://ramp.com | https://next.ramp.com/assets/images/default-og-image.jpg |
| `refs/daimo_home.jpg` | https://daimo.com | homepage screenshot, 2026-11-12 |
| `refs/linear_home.jpg` | https://linear.app | homepage screenshot, 2026-11-12 |
| `refs/near_og.jpg` | https://near.org | https://www.near.org/cms/54350b18bfb492b1.jpg |
| `refs/superfluid_og.jpg` | https://superfluid.org | https://superfluid.org/seo/superfluid.png |
| `refs/mercury_og.jpg` | https://mercury.com | https://www.datocms-assets.com/115132/1746056008-2025-04-30_fem_homepage-social_1200x630.webp |
| `refs/rainbow_og.jpg` | https://rainbow.me | https://rainbow.me/assets/og.png |

## 10. What I could not verify

- **neal.fun:** Cloudflare blocked the automated browser, so there is no screenshot. The description of "Spend Bill Gates' Money" comes from search results.
- **Blender, Unreal, Houdini and TouchDesigner details:** the pages exist, but the visual specifics (wire types, pin shapes, category colours, in-node previews) are from memory (⚠️). The blender.org features page and mini-motorways.com blocked automated access.
- **Other memory-only details (⚠️):** Mini Metro's procedural audio, Opus Magnum's GIF export, Factorio's alt-mode and FigJam's connector behaviour.
- **Family's current owner** is not stated on family.co, so I did not claim it.
- **Pitch:** I found nothing distinctive in today's og image.
- **Rive's "community showcase"** now redirects to a marketplace; I did not browse individual files.
- **NEAR palette:** the hex values were extracted from near.org's CSS today. They are not from an official brand guide, which I could not find.
