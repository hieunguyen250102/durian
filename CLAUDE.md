# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

This repo is a realtime multiplayer web version of Oink Games' card game **Durian** for 2–7 players. The UI text is in Vietnamese.

- `client/`: React 19, Vite, Framer Motion and socket.io-client. It is deployed to Vercel.
- `server/`: Node, Express and Socket.IO. It is deployed to Render.
- `shared/`: types and deck data that both sides import through relative paths such as `../../shared/types`. There is no workspace package.

## Commands

```bash
npm install && npm run install:all   # root devDeps plus client and server installs (separate node_modules)
npm run dev                          # server on :3210 (tsx watch) and client on :5173; Vite proxies /socket.io to :3210
npm test                             # server rules tests (node:test via tsx)
cd server && node --import tsx --test --test-name-pattern "gorilla" test/*.test.ts   # run matching tests only
npx tsc --noEmit -p server           # typecheck the server; the client checks types during `npm run build --prefix client`
npm run build                        # esbuild bundles the server to server/dist/index.js; vite builds client/dist
npm run images                       # regenerate client/public/assets/*.webp from images/*.png (needs Pillow)
```

## Architecture

- **The server is authoritative.** `server/src/game.ts` (`Room`) holds all game state and every rule check. `server/src/index.ts` is only the socket transport. It maps sockets to seats, handles reconnection by `sessionId`, and broadcasts after every action. Room state lives only in memory.
- **Each player gets their own view.** `Room.viewFor(playerId)` builds a separate `GameView` for each player. It hides the viewer's own inventory card until the reveal and never sends the draw pile. Any new state that must stay secret has to be filtered there.
- **Protocol.** The client sends `join` (with an ack) and `action` (`ClientAction`, with an ack of `{ok, error}`). The server emits `state` (`GameView`) and `kicked`. Error messages are Vietnamese strings shown as toasts.
- **Chat stays out of `GameView`.**
  - The client sends `chat` (text, with an ack). The server validates the message (`Room.addChat`), rate-limits it per socket and emits `chat` to the whole room.
  - A joining socket gets `chatHistory` with the last 80 messages.
  - Messages that exactly match a `QUICK_EMOTES` entry are tagged `emote` and float up from the sender's seat. Other messages show as speech bubbles (`useBubbles` in `Chat.tsx`).
  - Bots post short reactions after a bell (`botReactions` in `index.ts`).
- **Animations are driven by events.** Every mutation sets `room.event` (a `GameEvent` with an increasing `seq`). On the client, `useEventEffects` in `Table.tsx` plays sounds and effects when the seq changes. It plays them only for live events: `eventIsFresh()` in `net.ts` skips events seen on first load or reconnect.
  - The bell reveal is staged on the client: stage 1 bell, 2 cards flip and tally, 3 verdict and token flight, 4 game-over modal.
  - Until stage 3 the penalty token is held back in the center pile. The token uses a Framer `layoutId` (`token-N`) so it flies from the pile to the seat.
- **Bots run on the server.** The host adds them in the lobby (`addBot`). `server/src/bot.ts` decides from the bot's own `viewFor()`, so a bot knows only what a human in that seat would.
  - It computes the chance of over-ordering by treating every unseen card (its own card or the pile) as equally likely. It calls when that chance passes a slightly randomized threshold, and it picks the order half or gorilla flip with the lowest risk.
  - `scheduleBots` in `index.ts` keeps one timer per room and replans if the state changes before the timer fires.
  - Bots stop when no human is connected, and a room with only bots left is deleted.
- **Seat layout.** Seats sit on an ellipse computed from the measured table size. The viewer is at the bottom, and the next player (the one to "your left") goes clockwise on screen.
- **Sessions.** The client keeps its session in `sessionStorage`, so each tab counts as a separate player and a refresh keeps the seat. The last-used name is kept in `localStorage`.
- **Login.** Email-code login comes from the shared `oink-kit` package (github:hieunguyen250102/oink-kit). The server mounts `authHandler` (`POST /auth/request`, `/auth/verify`) and `socketAuth`, and `join` refuses sockets without a login; a `join` without a room code creates a room and needs `canHost` (`HOST_EMAILS`). The seat session above is unchanged: login is only a gate. The client stores the login under `durian.session.v1` in `localStorage` and sends it in the socket handshake. Without a mail provider outside production, the code is printed on the server and returned as `devCode`. In dev, Vite proxies `/auth` to :3210 too.
- **Deploy config.** `vercel.json` builds the client from the repo root and needs `VITE_SERVER_URL`. `render.yaml` defines the server and uses `CLIENT_ORIGIN` for CORS. When `client/dist` exists, the server also serves it, so a single Render service can run both.

## Game rules as implemented

These follow the rulebook in `Durian Rulebook _ RulesPal.html` (a saved page whose assets are missing; read it as text).

- **Deck and setup.** One shared deck of 31 cards: 28 fruit cards and 3 gorillas. Each player gets one inventory card that everyone else can see. In a 2-player game, one extra face-up card goes on the table.
- **Inventory.** Both halves of every inventory card count toward the stock.
- **Taking an order.** The active player draws a card and picks one half as the order. On the board, `Order.side` is the half facing ✓.
- **Gorilla drawn as an order.** The player flips an earlier order that is not locked, which switches it to its other half. The gorilla then locks that order. If no order can be flipped, the gorilla is wasted (`room.wasted`).
- **Calling the manager.** The active player can call only on the previous active player, and must call when the draw pile is empty.
  - Orders are compared with the inventory fruit by fruit. If any fruit is over-ordered, the called player is penalized; otherwise the caller is.
  - Gorillas in the inventory cancel orders at this point: Mitch cancels orders with 3 fruits, Hannah cancels banana orders, and Murphy does nothing.
- **Penalty and new round.** The loser takes the lowest remaining token (1–7). The next round starts with the player to the left of the loser.
- **End of game.** The game ends when anyone reaches 7 or more points. The fewest points wins; a tie goes to whoever holds fewer tokens.

The official list of the 28 fruit cards is **not published**. `FRUIT_CARD_SPECS` in `shared/deck.ts` is a distribution built to satisfy the rulebook's constraints. Keep it labelled as an assumption, and replace it if the real list turns up.

## Assets

- `images/` holds the original PNGs and `images/README_VI.md`, which describes each one.
- The game uses cropped WebP copies in `client/public/assets/`, with the `durian_` prefix dropped from the file names.
- The fruit card faces are composed in CSS (`CardFace`) from the four fruit icons. Card-shaped elements use an aspect ratio of 2.35:1.
