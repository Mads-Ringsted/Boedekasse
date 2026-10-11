# Bødekasse v1: design decisions

Decisions made while designing the v1 screens on the [design canvas](https://claude.ai/artifact/MHAxmQBTn6NGeYETRXu2o4). They build on the [screen design brief](v1-screens-brief.md) and on the later decisions in [Saldo and Indbetaling](https://github.com/Mads-Ringsted/Boedekasse/issues/9), [Bødekasse and membership](https://github.com/Mads-Ringsted/Boedekasse/issues/11), [Seasons](https://github.com/Mads-Ringsted/Boedekasse/issues/22), [Frikøb details](https://github.com/Mads-Ringsted/Boedekasse/issues/8) and [History and undo](https://github.com/Mads-Ringsted/Boedekasse/issues/31). Where this note and the brief disagree, this note wins.

The chosen screens are in [`mocks/`](mocks/). Each mock is one HTML file with inline styles at iPhone size (393 × 852). Open it in a browser, or give it to Claude as context when building that screen. The `<x-dc>` and `<helmet>` wrappers and the `text/x-dc` script come from the design tool; ignore them.

## Screens

| Screen | Mock | Brief section |
|---|---|---|
| Install guide (Safari) | [installer.html](mocks/installer.html) | 1 |
| Log ind: email | [log-ind.html](mocks/log-ind.html) | 2 |
| Log ind: code | [log-ind-kode.html](mocks/log-ind-kode.html) | 2 |
| Vælg Bødekasse | [vaelg-boedekasse.html](mocks/vaelg-boedekasse.html) | 3 |
| Velkommen (in no box yet) | [velkommen.html](mocks/velkommen.html) | 3 |
| Hjem (dark) | [hjem.html](mocks/hjem.html) | 4 |
| Hjem (light) | [hjem-lys.html](mocks/hjem-lys.html) | 4 |
| Hjem: a payment afventer | [hjem-afventer.html](mocks/hjem-afventer.html) | 4 |
| Hjem: undo toast (light) | [hjem-fortryd-lys.html](mocks/hjem-fortryd-lys.html) | 5 |
| Hjem: Pause | [hjem-pause.html](mocks/hjem-pause.html) | 4 |
| Giv bøder, step 1: Hvem | [giv-1-hvem.html](mocks/giv-1-hvem.html) | 5 |
| Giv bøder, step 2: Hvad | [giv-2-hvad.html](mocks/giv-2-hvad.html) | 5 |
| Giv bøder, step 3: Tjek og giv | [giv-3-tjek.html](mocks/giv-3-tjek.html) | 5 |
| Giv bøder, step 3b: one person | [giv-3b-person.html](mocks/giv-3b-person.html) | 5 |
| Betal (sheet) | [betal.html](mocks/betal.html) | 6 |
| Betal: report sent, afventer | [betal-afventer.html](mocks/betal-afventer.html) | 6 |
| Aktivitet | [aktivitet.html](mocks/aktivitet.html) | 7 |
| Bødekategorier | [boedekategorier.html](mocks/boedekategorier.html) | 8 |
| Bøde detail (sheet) | [boede-detalje.html](mocks/boede-detalje.html) | 9 |
| Anke: intro | [anke-intro.html](mocks/anke-intro.html) | 10 |
| Anke: wheel | [anke-hjul.html](mocks/anke-hjul.html) | 10 |
| Anke: verdict (sheet) | [anke-afgoerelse.html](mocks/anke-afgoerelse.html) | 10 |
| Medlem profile | [medlem.html](mocks/medlem.html) | 11 |
| Medlem: Admin actions (sheet) | [medlem-admin.html](mocks/medlem-admin.html) | 14 |
| Mere | [mere.html](mocks/mere.html) | 12 |
| Kassen | [kassen.html](mocks/kassen.html) | 13 |
| Registrér indbetaling (sheet) | [registrer-indbetaling.html](mocks/registrer-indbetaling.html) | 13 |
| Medlemmer | [medlemmer.html](mocks/medlemmer.html) | 14 |
| Konkurrencer | [konkurrencer.html](mocks/konkurrencer.html) | 15 |
| Ny Konkurrence (sheet) | [konkurrence-ny.html](mocks/konkurrence-ny.html) | 15 |
| Konkurrence result | [konkurrence-detalje.html](mocks/konkurrence-detalje.html) | 15 |
| Indstillinger | [indstillinger.html](mocks/indstillinger.html) | 16 |

Only Hjem has light-mode mocks so far. The other screens use the same light tokens (below).

## Decisions

### 1. Navigation
The tab bar is confirmed: **Hjem · Aktivitet · [+] · Kategorier · Mere**. It is a full-width bar with a raised, round, main-colour **+** in the middle that opens Giv bøder. The active tab uses the blue text colour. Pushed screens (Medlem, Kassen, Medlemmer, Konkurrencer, Indstillinger, Konkurrence result) keep the tab bar and show a back button named after the previous screen.

### 2. Hjem
Top to bottom:

1. **Header:** a small "Bødekasse" label above the box name with a switch chevron, and your avatar on the right.
2. **Box card:** main colour, only "I bødekassen · 570 kr", with a chevron. Tapping it opens Kassen.
3. **Two small cards:** **Indbetalt** (green amount) and **I alt ikke betalte bøder** (red amount). *Hævet* is not on Hjem; it lives in Kassen.
4. **Du mangler at betale:** one row with your amount and a **Betal** button.
5. **Afventer bekræftelse** (only when there is something to act on): a card with an orange outline per report, "Emil har betalt 85 kr", with **Afvis** and **Bekræft**.
6. **Topliste:** ranked by **Bøder i alt**. The top 3 stand on a podium; the rest are rows. Each person shows their total large and "Betalt X kr" small below.

Changes from the brief:
- The two big buttons (Giv bøde, Betal) are gone. Giv bøde is the **+** in the tab bar, and Betal sits in the "Du mangler" row.
- The Topliste has no Skylder / Betalt / Bøder i alt switch. It shows Bøder i alt only.

**During a Pause:** a Pause card under the header ("Sæson 2026 sluttede 30. sep", with "Start sæson" for Admins), the ended Sæson's Topliste ("Sæson 2026 · Bøder i alt"), and a greyed-out, disabled **+**. Betal still works.

### 3. Giv bøder is a three-step flow
The single sheet from the brief ("Udfylder for", "Samme til alle") is replaced by steps in one full-height sheet. A three-part progress bar sits under the header ("1 af 3").

1. **Hvem:** a grid of person tiles. Tap to select (blue tile with a tick). "Vælg alle" at the top. A Medlem with Frikøb is a greyed-out tile with a "Frikøb" tag and can't be selected. Button: "Næste · 2 valgt".
2. **Hvad:** one list of Bødekategorier with search. Every Bøde added here goes to **everyone selected**; a line shows who ("Gælder for Jonas og Emil"). Tapping + adds one; a row with a count shows a − / count / + stepper. Footer: "1 bøde til hver · 100 kr i alt" and "Næste".
3. **Tjek og giv:** one card per person with their Bøder, amounts and total. Tapping a person or "Tilføj bøde" opens a second sheet (**3b**) with the same list for **that person only**. Footer: "5 bøder til 2 personer · 210 kr" and "Giv 5 bøder · 210 kr".

No headings or explainer text inside the steps; each screen does one job.

**Undo toast:** after giving, a dark toast sits just above the tab bar: a green tick, "5 bøder givet · 210 kr" and **Fortryd**. A thin bar along its bottom edge counts down the ~8 seconds.

### 4. "Ofte brugt" is part of the list
There is no separate chip row of favourites. The 5 most-used Bødekategorier sit at the top of the one list, each with a small blue **Ofte brugt** tag next to its price. The rest follow alphabetically. The same pattern is used on the Bødekategorier screen, where each row also shows "Brugt 34 gange".

### 5. Colours
Brief tokens apply, with these additions and changes:

| Use | Dark | Light |
|---|---|---|
| Raised surface (list cards, inputs inside sheets) | `#1C2232` | `#FFFFFF` on `#F2F3F8` |
| Unpaid / owed amounts (red) | `#FF6369` | `#CE2C31` |
| Paid / money in (green) | `#3DD68C` | `#0A8754` |
| Waiting: Anket, Afventer (orange, new) | `#FFB547` | not yet defined |

- **Light-mode red and green are darker than the brief** (`#E5484D` and `#0E9F64`). The brief's values are below 4.5:1 contrast for small text on white.
- **Red now means "not paid yet"**, not only errors. It is used for "I alt ikke betalte bøder", "Mangler at betale" on a profile, and what each Medlem owes on Medlemmer. Destructive actions (Meld ud, Slet, Log ud, Slet Bødekasse) also use red text.
- **Orange means "waiting for someone"**: the Anket tag, and the outline and dot on Afventer cards.
- **Status tags** are small rounded labels: Anket (orange), Anke vundet (green), Anke tabt (red), Annulleret (grey, with the row greyed and the amount struck through), Frikøb (blue), Ofte brugt (blue), Admin (blue).

### 6. Sheets
- **Full height** for flows: Giv bøder, Ny Konkurrence, Registrér indbetaling, Anke. They have Annullér or Tilbage on the left, a centred title, and a fixed footer or button at the bottom.
- **Partial height** for quick views and choices: Bøde detail, Betal, Anke verdict, Medlem Admin actions. They have a close (X) button.
- A sheet opened from another sheet (Giv step 3b) stacks on top with the sheet behind it visible.

### 7. Konkurrencer
- **Ny Konkurrence:** Titel and Dato, then all Medlemmer. Tap people in finishing order; each placed row shows its number and Gebyr. Untapped people show "Fraværende · 50 kr". The footer shows "3 placeret · 5 fraværende" with the total.
- **Result screen:** reuses the Hjem podium for the top 3, then the remaining places, then a "Fraværende" group.
- **In Aktivitet:** one grouped row with a trophy icon: "Konkurrence: Bowling · Frederik vandt · 8 gebyrer · 260 kr".
- **In a Medlem's history:** "Bowling · Konkurrence · 3. plads · 25 kr".

### 8. Payments (Betalingsmelding)
- **Betal:** "Du mangler at betale" large, the MobilePay Box number with **Kopiér**, three short steps, an editable **Beløb** (pre-filled with what you owe) and "Jeg har betalt 6 kr".
- **After reporting:** the Betal sheet shows an orange **Afventer** card, "Du har meldt 6 kr betalt", with **Fortryd**.
- **Confirming:** others see the report on Hjem and on Kassen with **Afvis / Bekræft**.
- **Kassen:** the box card, then Indbetalt / Hævet / Mangler, then Admin buttons **Registrér indbetaling** and **Hæv penge**, then any reports that afventer, then the list of Indbetalinger and Hævninger. A removed one is greyed and struck through, "Fjernet af Frederik".
- **Registrér indbetaling:** who (with what they owe), a large editable amount pre-filled with what they owe, and an optional note.

### 9. Aktivitet rows
- A Giv batch is **one row per receiver**: "Jonas gav Emil 3 bøder · 2× For sent, Spildt drikke · 120 kr", with a chevron to expand.
- A Gebyr sits **on the row of its cause**: "Frederik gav Lucas en engangsbøde · 100 kr" with "+10 kr gebyr" below the amount.
- An annulled Bøde stays in place, greyed, tagged "Annulleret", with "annulleret af Frederik" and the amount struck through.

### 10. Anke
- **Intro:** the Bøde being appealed, then three short points (it costs a Gebyr of 1–100 kr whatever happens; the group decides; if you win, the Bøde moves). Button: "Anke og drej hjulet". Spinning the wheel *is* filing the Anke, so there is no cancel after the spin.
- **Wheel:** a segmented ring in the surface colours with a white pointer at the top. The segment it lands on turns blue, and the Gebyr is revealed large in the centre ("37 kr", "af 1–100 kr"). Below: "Anken er sendt". The spin itself is motion only (smooth ease-out).
- **Verdict:** a sheet for any Medlem other than the two involved. The Bøde with an "Anket" tag, then two radio cards: **Bøden står ved magt** ("Emil betaler de 50 kr") and **Anken vinder** ("Bøden flyttes til Jonas"). A note says the Anke Gebyr stays.
- The appeal window is **24 hours** ("19 timer endnu" on the Bøde detail sheet).

### 11. Membership
- **Medlemmer:** for Admins, a join-code card at the top ("K7P2QX" in a monospaced font) with **Del** and a "Ny kode" button. Then every Medlem with what they owe. Your own row is highlighted. "Tidligere medlemmer" sit at the bottom with what they still owe and **Genoptag**.
- **Medlem Admin actions:** a sheet with Registrér indbetaling, Gør til Admin, Ret navn and Ret email (only before they log in). Then a separate red group: Meld ud and Slet. Slet is disabled with a reason when the Medlem has history.
- **Velkommen:** two large cards, **Opret Bødekasse** (blue, "Start en ny og bliv Admin") and **Jeg har en kode**, with "Log ud" at the bottom.
- **Vælg Bødekasse:** one row per box (initial tile, name, number of Medlemmer), with "Opret ny" and "Jeg har en kode" at the bottom.

### 12. Small patterns
- Avatars are initials on a pale-blue circle. A Medlem who has not logged in yet has a dashed avatar. A former Medlem has a grey avatar.
- Your own row is highlighted in blue and labelled "Dig".
- Admin-only actions carry a small "Kun Admin" or "Admin" label in the mocks; in the app they are hidden from ordinary Medlemmer.
- The app icon placeholder is a coins icon on a blue rounded square (install guide, log in).

## Placeholders and open questions

- **MobilePay Box number** "1234 5678", the join code "K7P2QX", the former Medlem "Anders Vang" and the boxes "Klassen fra 2012" and "Poker-tirsdag" are placeholders.
- **Tap count for one Bøde** is now 6 (+ → person → Næste → Bøde → Næste → Giv); the brief's target was 4. One option: let step 2's button give the Bøder directly and make step 3 optional, which gives 5 taps.
- **Frikøb on the Topliste:** the mock counts the 300 kr Frikøb Gebyr in Oliver's "Bøder i alt".
- **App icon:** the coins placeholder needs a real icon.
- **Not designed yet:** Ny bødekategori and Bødekategori detail sheets, Engangsbøde, Hæv penge, Tilføj Medlem, Opret Bødekasse and "Jeg har en kode" forms, Køb Frikøb confirm, Annullér bøde and Ændr afgørelse, Slet Bødekasse confirm, "Til gode" on Hjem, "Betal til en Admin" (no Box number), empty states, and light mode for screens other than Hjem.
