# Bødekasse v1: screen design brief

A brief for designing every v1 screen of Bødekasse (for example in Claude Design). It records what each screen shows and how it behaves, as decided in [Core screens and navigation](https://github.com/Mads-Ringsted/Boedekasse/issues/13) on the [Bødekasse v1 map](https://github.com/Mads-Ringsted/Boedekasse/issues/2). The visual design is open: make it look and feel like a polished native iPhone app, starting from the brand anchors below.

**Done when** every screen in [Screens](#screens) is designed at iPhone size (393 × 852) in light and dark mode, using the sample data below, with the Admin-only parts marked.

## The product

Bødekasse is a shared fine box for a group of friends, such as a football team or an old school class. Members fine each other for breaking agreed rules (being late, a phone at the table), the money goes into the box, and the group spends it together, for example on a Christmas dinner. One person can be in several boxes.

- **Who uses it:** friends on iPhones, often in the middle of a gathering, one-handed, sometimes a few beers in. The moments that matter most are giving a fine fast and seeing who owes what.
- **Platform:** a web app installed to the iPhone home screen (PWA). It always runs full screen, so design it as a native iOS app with safe areas, a home indicator and no browser chrome.
- **Language:** the whole UI is Danish. Use the Danish terms below exactly as written.
- **Look and feel:** clean, simple and aesthetic. Calm typography, generous spacing, one confident blue and quiet neutrals, with the clarity of MobilePay. The interface uses text and Lucide icons only; any personality comes from the copy and the motion.

## Brand anchors

These come from the [Design system](https://github.com/Mads-Ringsted/Boedekasse/issues/12) decision. The blue is fixed. Treat the rest as a starting point and refine it freely.

| Token | Light | Dark |
|---|---|---|
| Main colour (royal blue, like a Shaker Sport can) | `#1E50E6` | `#3B68F5` |
| Blue text and icons | `#1A46CC` | `#8AA6FF` |
| Pale blue fill | `#E4EBFD` | `#182650` |
| Background | `#F2F3F8` | `#0A0C12` |
| Surface | `#FFFFFF` | `#151924` |
| Text | `#0E1220` | `#F1F3F9` |
| Muted text | `#636A7E` | `#9298AB` |
| Lines | `#E1E4ED` | `#252A39` |
| Paid / money in (green) | `#0E9F64` | `#3DD68C` |
| Error (red) | `#E5484D` | `#FF6369` |

- **Font:** the iPhone system font (SF Pro), with tabular numbers for all amounts.
- **Icons:** Lucide, 2px stroke.
- **Theme:** light and dark follow the phone's setting.
- **Build constraint:** the app is built with custom CSS components and Radix primitives for sheets, dialogs and menus, so every component in the design has to be buildable that way.

## Words on screen

Danish domain terms (full definitions are in `GLOSSARY.md` on the main branch):

- **Bødekasse:** the box. Its name sits at the top of Hjem and switches between boxes.
- **Medlem / Medlemmer:** a person in the box. **Admin** is a Medlem who manages settings, Medlemmer and Indbetalinger.
- **Bødekategori:** a named fine with a fixed price, such as "For sent · 50 kr".
- **Bøde / Bøder:** a fine one Medlem gives another.
- **Engangsbøde:** a one-off Bøde with a free-text reason and amount.
- **Gebyr:** a fee charged by the box itself, for example for creating a Bødekategori, giving an Engangsbøde, filing an Anke or placing in a Konkurrence.
- **Anke:** an appeal against a Bøde you received.
- **Frikøb:** a 300 kr buy-out that covers your ordinary Bøder for the rest of the year.
- **Konkurrence:** a contest. Each placement costs a Gebyr.
- **Indbetaling:** money paid into the box. **Hæv penge:** money taken out.

On screen, what a Medlem owes is shown as **"Mangler"** ("Du mangler at betale 50 kr") or **"Skylder"** in lists. The domain word is *Saldo*, but the screens use the plain words.

Amounts are written `1.250 kr` (Danish thousands separator, "kr" after).

## Navigation

A bottom tab bar with five slots: **Hjem · Aktivitet · [+] · Kategorier · Mere**. The middle **+** is a raised main-colour button that opens Giv bøder from anywhere. *(Proposed in round 2; Mads to confirm.)*

- The Bødekasse name at the top of Hjem opens a sheet for switching boxes.
- Detail screens push with a back button. Quick tasks (Giv bøder, Betal, Ny bødekategori, a Bøde's details) open as bottom sheets.

## Screens

### 1. Install guide (opened in Safari)
Shown when the link is opened in the browser instead of the installed app. Explains in three steps how to add the app to the home screen (Del → Føj til hjemmeskærm → open from the home screen). Login happens inside the installed app. Requires iOS 17.5 or later.

### 2. Log ind
Email field, then a "Send kode" button. Next screen: "Tjek din mail", six digit boxes for the 6-digit code (supports iOS one-time-code autofill), and "Send ny kode". A Medlem an Admin has already added logs in with that same email and takes over their spot.

### 3. Vælg Bødekasse
Shown after login when you are in more than one box and this device has no last-used box (otherwise the app reopens the last one). Each row shows the box name and its number of Medlemmer, with "Opret ny Bødekasse" and "Jeg har en kode" at the bottom. Skipped when you are in only one box.

**Velkommen** (in no box yet): two choices, "Opret Bødekasse" and "Jeg har en kode".

- **Opret Bødekasse:** box name and your name in it, then you land on an empty Hjem as its first Admin.
- **Jeg har en kode:** a 6-character join code and your name, then you land on that box's Hjem.

### 4. Hjem
Top to bottom:

1. **Header:** the Bødekasse name with a switch chevron, and your avatar on the right (opens your profile).
2. **Box card:** the main-colour card shows only **how much is in the Bødekasse** ("I bødekassen · 570 kr"). Tapping it opens Kassen.
3. **Two big actions side by side:** **Giv bøde** (primary, main colour) and **Betal**.
4. **What's missing:** "Du mangler at betale" next to "Alle mangler at betale".
5. **Topliste:** every Medlem ranked, sortable by **Skylder · Betalt · Bøder i alt**. Each row shows rank, avatar, first name, the sorted amount, and a secondary line ("Betalt 80 kr"). Your own row is highlighted. Tapping a row opens that Medlem.

Open Anker are not shown on Hjem.

### 5. Giv bøder (bottom sheet, the core flow)
It has to be **fast for one Bøde and flexible for a whole evening**. A common case is one person registering everything from a gathering afterwards, with different Bøder in different counts per person.

Layout, top to bottom:

1. **Hvem:** a horizontal row of Medlem avatars. Tapping one selects that person and makes them the one being filled in (strongly highlighted). Other selected people stay marked, and a badge on each avatar shows how many Bøder they have so far. Tapping the person being filled in again deselects them.
2. A line "Udfylder for **Jonas**" and, when two or more people are selected, a **"Samme til alle"** toggle. With it on, every tap applies to all selected people.
3. **Hvad:** a search field, a row of the five most-used Bødekategorier as chips, a Navn/Pris sort switch, then the full list. Tapping a Bødekategori adds one, so tapping again makes it two. Once a row has a count it shows a − / count / + stepper.
4. At the end of the list: **Ny bødekategori** (shows its Gebyr, e.g. 25 kr) and **Engangsbøde** (reason + amount; the giver pays a 10 kr Gebyr).
5. **Footer:** a one-line summary per person ("Jonas: 2× For sent, 1× Hygge i stedet for træning · Emil: 1× For sent, 1× Spildt drikke") and the button **"Giv 5 bøder · 210 kr"**.

Speed target: + → person → Bøde → Giv is 4 taps. After giving, a toast says "5 bøder givet · 210 kr" with **Fortryd** (undo).

Design both states: one Bøde to one person, and the example evening above filled in.

### 6. Betal (bottom sheet)
"Du mangler at betale" with the amount large, then the box's MobilePay Box number with a copy button. Explains that you pay in MobilePay and an Admin then registers it. Button: "Jeg har betalt 50 kr". Whether that button exists is still open in [Saldo and Indbetaling](https://github.com/Mads-Ringsted/Boedekasse/issues/9), so design it as optional.

### 7. Aktivitet
A feed of everything that happened, newest first:

- **Bøder:** "Jonas gav Emil en bøde · For sent · 35 min · 50 kr"
- **Gebyrer**
- **Indbetalinger** (green, "+80 kr")
- **Hævninger**
- **Frikøb**
- **Konkurrencer**, grouped into one row ("Konkurrence: Bowling · 8 gebyrer · 260 kr")

Bøder can carry a status tag: **Anket**, **Anke vundet**, **Anke tabt** or **Frikøb** (amount struck through). Tapping a Bøde opens its detail sheet.

### 8. Bødekategorier
Title with a + button, search, "Mest brugt" (top 5), a Navn/Pris switch and the full list. Each row shows name, price and how many times it has been used. Archived ones are listed in a small line at the bottom.

- **Detail sheet:** name, price, description, creator, use count, a "Giv denne bøde" button, and Redigér/Arkivér for the creator and Admins. Changing the price applies only to new Bøder.
- **Ny bødekategori sheet:** name (unique among active ones; a Medlem may type an emoji into the name text, so names render as plain text whatever they contain), price, optional description, and a notice that creating one costs a 25 kr Gebyr (when the Admin has that rule on).

### 9. Bøde detail (bottom sheet)
Name, amount, "Fra Frederik til dig · 5 t". Actions depend on who you are:

- **Received within 7 days:** "Anke bøden".
- **Anket, and you are not one of the two involved:** "Registrér gruppens afgørelse".
- **Anket, and you are involved:** a note that the group decides.

### 10. Anke
1. **Intro:** filing costs a random Gebyr between 1 kr and twice the Bøde, paid whatever the outcome.
2. **Wheel:** a wheel spins and lands on the Gebyr. Keep it in the same clean visual language as the rest of the app, with a smooth spin and a clear reveal of the amount.
3. **Verdict sheet** (recorded by another Medlem): "Bøden står ved magt" or "Anken vinder" (the Bøde moves to the Medlem who gave it).

### 11. Medlem profile
Avatar, name, tags (Admin, Frikøb 2026, Ikke logget ind endnu), "Mangler at betale" large, then Bøder og gebyrer next to Betalt. Actions: Giv bøde (pre-selects this person), Betal (on your own profile), and Registrér indbetaling (Admin). On your own profile, a "Kan ankes" section lists Bøder still within the 7-day appeal window. Then the full history.

### 12. Mere
Your profile row (your name in this box, editable; "Slet konto" at the bottom of your profile), then Medlemmer, Kassen og indbetalinger, Anker (with count), Konkurrencer, Indstillinger (Admin), Skift Bødekasse, Log ud.

### 13. Kassen
Card with "I bødekassen", plus Indbetalt, hævet and mangler. Admin buttons: **Registrér indbetaling** (pick a Medlem, amount pre-filled with what they owe) and **Hæv penge** (amount + purpose, e.g. "Depositum til julefrokost"). Below: the list of Indbetalinger and Hævninger.

### 14. Medlemmer
List with what each owes. Admins get "Tilføj Medlem" (name + email; the person can receive Bøder before they ever log in) and can make others Admin.

- **Join code (Admin):** the box's code (e.g. `K7P2QX`) with "Del" (shares an invite text with the code) and "Ny kode" (the old one stops working).
- **Medlem actions (Admin), on a Medlem's profile:** Gør til Admin / Fjern som Admin, Ret navn, Ret email (only before they've logged in), Meld ud (also when they still owe), and Slet (only for someone who never logged in and has no history). The last Admin can't drop the role.
- **Tidligere Medlemmer:** udmeldte Medlemmer at the bottom with what they still owe and "Genoptag" (Admin).

### 15. Konkurrencer
List of Konkurrencer (title, date, how many placed or absent, total).

**Ny Konkurrence:** title, date, then tap Medlemmer in finishing order. Each row shows its place and Gebyr (0 / 10 / 25 / 35 / 40 / 45 / 50 kr; places beyond 7 pay 50 kr). Unplaced Medlemmer show "Fraværende · 50 kr".

### 16. Indstillinger (Admin)
- **Bødekasse:** name, MobilePay Box number, Medlemmer og roller, and "Slet Bødekasse" (type the name to confirm; gone for everyone).
- **Særlige regler:**
  - Gebyr for ny bødekategori (on/off + 25 kr)
  - Gebyr for engangsbøde (10 kr)
  - Anke (on/off, 7-day window)
  - Frikøb (on/off + 300 kr)
  - Konkurrencegebyrer
- **Sæson og data:** Start ny sæson, Eksportér data.

A new box starts with every Særlig regel off, except the Engangsbøde Gebyr (on, 10 kr).

### States to cover
- Admin vs. ordinary Medlem (Admin-only actions hidden).
- A Medlem not yet logged in (dashed avatar).
- Empty states: a new box with no Bøder, and no Bødekategorier yet.
- The undo toast, and a disabled Giv button before anything is picked.

## Sample data

Box **FC Ølhunde**, 8 Medlemmer: Mads Ringsted (Admin, you), Jonas Holm, Frederik Lund (Admin), Oliver Krogh (Frikøb), Emil Bach, Kasper Nørgaard, Lucas Berg, Sebastian Juhl (not logged in yet).

Bødekategorier (sample names are plain text):

| Bødekategori | Price |
|---|---|
| For sent | 50 kr |
| Telefon ved bordet | 20 kr |
| Bandeord | 10 kr |
| Spildt drikke | 20 kr |
| Hygge i stedet for træning | 40 kr |
| Ikke drukket op | 30 kr |
| Glemt udstyr | 25 kr |
| Glemt at melde afbud | 30 kr |
| Gult kort | 40 kr |
| Glemt kage på fødselsdag | 100 kr |

Box state: I bødekassen 570 kr · indbetalt 870 kr · hævet 300 kr · alle mangler 344 kr · Mads mangler 6 kr.

## Reference

The clickable prototype answers **structure and flow**: what is on each screen and how it behaves. Its visuals are a rough sketch, so design the look fresh.

- **Mocks and design decisions:** [v1-design-decisions.md](v1-design-decisions.md) lists the chosen screens in [`mocks/`](mocks/) and the decisions that update this brief.
- **Prototype:** `prototypes/core-screens/index.html` on branch [`claude/gracious-bardeen-r7lvf3`](https://github.com/Mads-Ringsted/Boedekasse/tree/claude/gracious-bardeen-r7lvf3/prototypes/core-screens). Open it at `#h1g1` for the chosen home screen and Giv flow.
- **Out of v1:** push notifications, automatic or recurring Bøder, in-app games, location-based Bøder, MobilePay payment sync.
