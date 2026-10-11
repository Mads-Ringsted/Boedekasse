# Bødekasse v1: design decisions

Decisions made while designing the v1 screens on the [design canvas](https://claude.ai/artifact/MHAxmQBTn6NGeYETRXu2o4). They build on the [screen design brief](v1-screens-brief.md). Where this note and the brief disagree, this note wins.

The chosen screens are in [`mocks/`](mocks/). Each mock is one HTML file with inline styles at iPhone size (393 × 852). Open it in a browser, or give it to Claude as context when building that screen. The `<x-dc>` and `<helmet>` wrappers and the `text/x-dc` script come from the design tool; ignore them.

## Screens

| Screen | Mock | Brief section |
|---|---|---|
| Hjem (dark) | [hjem.html](mocks/hjem.html) | 4 |
| Hjem (light) | [hjem-lys.html](mocks/hjem-lys.html) | 4 |
| Giv bøder, step 1: Hvem | [giv-1-hvem.html](mocks/giv-1-hvem.html) | 5 |
| Giv bøder, step 2: Hvad | [giv-2-hvad.html](mocks/giv-2-hvad.html) | 5 |
| Giv bøder, step 3: Tjek og giv | [giv-3-tjek.html](mocks/giv-3-tjek.html) | 5 |
| Giv bøder, step 3b: one person | [giv-3b-person.html](mocks/giv-3b-person.html) | 5 |
| Betal (sheet) | [betal.html](mocks/betal.html) | 6 |
| Aktivitet | [aktivitet.html](mocks/aktivitet.html) | 7 |
| Bødekategorier | [boedekategorier.html](mocks/boedekategorier.html) | 8 |
| Bøde detail (sheet) | [boede-detalje.html](mocks/boede-detalje.html) | 9 |
| Medlem profile | [medlem.html](mocks/medlem.html) | 11 |
| Mere | [mere.html](mocks/mere.html) | 12 |
| Konkurrencer | [konkurrencer.html](mocks/konkurrencer.html) | 15 |
| Ny Konkurrence (sheet) | [konkurrence-ny.html](mocks/konkurrence-ny.html) | 15 |
| Konkurrence result | [konkurrence-detalje.html](mocks/konkurrence-detalje.html) | 15 |

Only Hjem has a light-mode mock so far. The other screens use the same light tokens (below).

## Decisions

### 1. Navigation
The tab bar is confirmed: **Hjem · Aktivitet · [+] · Kategorier · Mere**. It is a full-width bar with a raised, round, main-colour **+** in the middle that opens Giv bøder. The active tab uses the blue text colour. Pushed screens (Medlem, Konkurrencer, Konkurrence result) keep the tab bar and show a back button named after the previous screen.

### 2. Hjem
Top to bottom:

1. **Header:** a small "Bødekasse" label above the box name with a switch chevron, and your avatar on the right.
2. **Box card:** main colour, only "I bødekassen · 570 kr", with a chevron. Tapping it opens Kassen.
3. **Two small cards:** **Indbetalt** (green amount) and **I alt ikke betalte bøder** (red amount). *Hævet* is not on Hjem; it lives in Kassen.
4. **Du mangler at betale:** one row with your amount and a **Betal** button.
5. **Topliste:** ranked by **Bøder i alt**. The top 3 stand on a podium; the rest are rows. Each person shows their total large and "Betalt X kr" small below.

Changes from the brief:
- The two big buttons (Giv bøde, Betal) are gone. Giv bøde is the **+** in the tab bar, and Betal sits in the "Du mangler" row.
- The Topliste has no Skylder / Betalt / Bøder i alt switch. It shows Bøder i alt only.

### 3. Giv bøder is a three-step flow
The single sheet from the brief ("Udfylder for", "Samme til alle") is replaced by steps in one full-height sheet. A three-part progress bar sits under the header ("1 af 3").

1. **Hvem:** a grid of person tiles. Tap to select (blue tile with a tick). "Vælg alle" at the top. Button: "Næste · 2 valgt".
2. **Hvad:** one list of Bødekategorier with search. Every Bøde added here goes to **everyone selected**; a line shows who ("Gælder for Jonas og Emil"). Tapping + adds one; a row with a count shows a − / count / + stepper. Footer: "1 bøde til hver · 100 kr i alt" and "Næste".
3. **Tjek og giv:** one card per person with their Bøder, amounts and total. Tapping a person or "Tilføj bøde" opens a second sheet (**3b**) with the same list for **that person only**. Footer: "5 bøder til 2 personer · 210 kr" and "Giv 5 bøder · 210 kr".

No headings or explainer text inside the steps; each screen does one job.

### 4. "Ofte brugt" is part of the list
There is no separate chip row of favourites. The 5 most-used Bødekategorier sit at the top of the one list, each with a small blue **Ofte brugt** tag next to its price. The rest follow alphabetically. The same pattern is used on the Bødekategorier screen, where each row also shows "Brugt 34 gange".

### 5. Colours
Brief tokens apply, with these additions and changes:

| Use | Dark | Light |
|---|---|---|
| Raised surface (list cards, inputs inside sheets) | `#1C2232` | `#FFFFFF` on `#F2F3F8` |
| Unpaid / owed amounts (red) | `#FF6369` | `#CE2C31` |
| Paid / money in (green) | `#3DD68C` | `#0A8754` |
| Waiting, for example "Anket" (orange, new) | `#FFB547` | not yet defined |

- **Light-mode red and green are darker than the brief** (`#E5484D` and `#0E9F64`). The brief's values are below 4.5:1 contrast for small text on white.
- **Red now means "not paid yet"**, not only errors. It is used for "I alt ikke betalte bøder" and "Mangler at betale" on a profile.
- **Status tags** are small rounded labels: Anket (orange), Anke vundet (green), Anke tabt (red), Frikøb (blue, on a bought-out Bødekategori), Ofte brugt (blue), Admin (blue).

### 6. Sheets
- **Full height** for flows: Giv bøder, Ny Konkurrence. They have Annullér or Tilbage on the left, a centred title, and a fixed footer with a one-line summary above the main button.
- **Partial height** for quick views: Bøde detail, Betal. They have a close (X) button.
- A sheet opened from another sheet (Giv step 3b) stacks on top with the sheet behind it visible.

### 7. Konkurrencer
- **Ny Konkurrence:** Titel and Dato, then all Medlemmer. Tap people in finishing order; each placed row shows its number and Gebyr. Untapped people show "Fraværende · 50 kr". The footer shows "3 placeret · 5 fraværende" with the total.
- **Result screen:** reuses the Hjem podium for the top 3, then the remaining places, then a "Fraværende" group.
- **In Aktivitet:** one grouped row with a trophy icon: "Konkurrence: Bowling · Frederik vandt · 8 gebyrer · 260 kr".
- **In a Medlem's history:** "Bowling · Konkurrence · 3. plads · 25 kr".

### 8. Small patterns
- Avatars are initials on a pale-blue circle. A Medlem who has not logged in yet has a dashed avatar.
- Your own row is highlighted in blue and labelled "Dig".
- Admin-only actions carry a small "Kun Admin" or "Admin" label in the mocks; in the app they are hidden from ordinary Medlemmer.

## Placeholders and open questions

- **MobilePay Box number** "1234 5678" in the Betal mock is a placeholder.
- **"Jeg har betalt" button** is in the Betal mock but is still open in [Saldo and Indbetaling](https://github.com/Mads-Ringsted/Boedekasse/issues/9).
- **Tap count for one Bøde** is now 6 (+ → person → Næste → Bøde → Næste → Giv); the brief's target was 4. One option: let step 2's button give the Bøder directly and make step 3 optional, which gives 5 taps.
- **Does a Frikøbsgebyr count** in a Medlem's "Bøder i alt" on the Topliste? The mock counts it.
- **Not designed yet:** Install guide, Log ind, Vælg Bødekasse, Kassen, Medlemmer, Indstillinger, Anke intro, wheel and verdict, the undo toast, empty states, and light mode for screens other than Hjem.
