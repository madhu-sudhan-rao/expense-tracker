# Personal Finance Tracker — v1 Spec (draft for approval)

## Scope decisions
| Decision | Choice |
|---|---|
| Storage | Local-only (browser IndexedDB) on each device. No login in v1 |
| Users | Single user |
| Goal deposits | Count as an **expense** (category "Savings") |
| Currency | User picks one from a dropdown in Settings; used across the whole app |
| App lock | Not in v1 |
| Later phases | Google sign-in + Supabase sync, then the v2 feature list below |

> Note: in v1, phone and desktop each keep their **own** data. Use Export/Import to move data between them until sync arrives.

## Platform & stack
- **PWA**: a web app you install from the browser ("Add to Home Screen"). Works offline, feels like an app on the phone, and runs as a normal site on desktop.
- **Vite + React + TypeScript**
- **Dexie** (IndexedDB wrapper) for storage
- **Recharts** for charts
- **vite-plugin-pwa** for installability and offline use
- Hosting: free static host (Vercel / Netlify / GitHub Pages), so the phone can open it

**Sync-ready from day one:** every record has a UUID `id`, `createdAt`, `updatedAt`, and a soft-delete `deletedAt`. Adding Supabase later then means pushing and pulling rows, with no data migration.

## Screens
**Phone:** bottom tabs — **Home · Transactions · Goals · More** — plus a floating **+** button.
**Desktop:** the same screens with a left sidebar and wider multi-column layouts.

1. **Home (dashboard)**
   - Month switcher (‹ Nov 2026 ›)
   - Cards: Income, Expense, Net (income − expense)
   - Spending-by-category donut chart
   - Budget bars (top categories, warning at 80% and 100%)
   - Goals progress (top 3)
   - Recent transactions (last 5)
2. **Add / Edit transaction** (bottom sheet on phone, dialog on desktop)
   - Type toggle (Expense / Income) → large amount keypad → category grid → date (default today) → payment method → note → Save
   - The goal is about 3 taps for a typical expense
3. **Transactions**
   - List grouped by day, with daily totals
   - Search (note/category) and filters: month, type, category, payment method, amount range
   - Tap to edit; swipe or button to delete (with Undo)
4. **Goals**
   - List of cards: name, icon, saving-in, progress bar, saved / target, deadline
   - **Goal detail:** balance, remaining amount, "save X/month to reach by deadline", buttons **Add money** and **Withdraw**, plus the full history log (date, +/− amount, note, running balance)
   - Create/edit goal: name, target amount, saving in, deadline (optional), icon/colour
   - Mark as achieved / archive
5. **Budgets**
   - Monthly limit per category (same limit every month unless changed)
   - Spent vs limit for the selected month
6. **Recurring**
   - Rules such as rent (monthly on the 1st), salary, or Netflix
   - Fields: template transaction, frequency (daily/weekly/monthly/yearly), start date, optional end date
   - **Auto-add** or **remind me** mode. With no server, due items are created or shown when the app opens, including any missed while it was closed.
7. **More / Settings**
   - Currency dropdown (₹ INR, $ USD, € EUR, £ GBP, … full ISO list with search)
   - Categories manager (add, rename, icon, colour, archive) for expense and income separately
   - Payment methods manager (Cash, UPI, Debit card, Credit card, Bank transfer — editable)
   - Theme: Light / Dark / System
   - Backup: **Export JSON**, **Import JSON** (replace or merge), **Export CSV** (transactions)
   - "Last backup" reminder if it's been more than 30 days

## Data model
```
Transaction  { id, type: 'expense'|'income', amount, categoryId, date,
               paymentMethodId?, note?, goalEntryId?, recurringId?,
               createdAt, updatedAt, deletedAt? }

Category     { id, name, type: 'expense'|'income', icon, color,
               isSystem, archived, ... }

PaymentMethod{ id, name, icon, archived, ... }

Goal         { id, name, targetAmount, savingIn, deadline?, icon, color,
               status: 'active'|'achieved'|'archived', ... }

GoalEntry    { id, goalId, type: 'deposit'|'withdrawal', amount, date,
               note?, transactionId, ... }

Budget       { id, categoryId, monthlyLimit, ... }

Recurring    { id, template: {type, amount, categoryId, paymentMethodId, note},
               frequency, interval, startDate, endDate?, mode: 'auto'|'remind',
               lastGeneratedDate, ... }

Settings     { currency, theme, lastBackupAt }
```
Amounts are stored as **integers in minor units** (paise or cents) to avoid floating-point rounding errors.

## Goal ↔ expense linkage
- **Add money to goal** → creates a `GoalEntry(deposit)` **and** an expense `Transaction` in the system category **"Savings"**, linked both ways.
- **Withdraw from goal** → creates a `GoalEntry(withdrawal)` **and** an income `Transaction` in the system category **"Savings withdrawal"**. *(Proposed: needs your OK.)*
- Editing or deleting either side updates or deletes the other.
- Goal balance = Σ deposits − Σ withdrawals, always calculated from the history.
- Budgets ignore the "Savings" category by default.

## Default categories
**Expense:** Food & Dining, Groceries, Transport, Fuel, Shopping, Bills & Utilities, Rent, Health, Entertainment, Education, Travel, Subscriptions, Gifts, Personal care, Savings (system), Other
**Income:** Salary, Freelance, Business, Interest, Refund, Gift, Savings withdrawal (system), Other

## Out of scope for v1 (planned later)
- Phase 2: Google sign-in + Supabase sync across devices
- Multiple accounts/wallets with balances and transfers
- Credit card bills and EMI tracking
- Lend/borrow tracking
- Push notifications and bill reminders
- Advanced reports (month-over-month trends, yearly summary)
- Receipt photos
- Bank statement / SMS import
- Split expenses, net worth view
- App lock

## Decisions on the open questions (defaults used in v1)
1. Taking money back from a goal is recorded as **income** in "Savings withdrawal".
2. Months run from the 1st to the last day of the month. A custom start day can come later.
3. The default categories are the ones listed above. They can be edited under More → Categories.

## v1.1: Icons, accounts and cards
- **Icons:** Lucide line icons for categories, goals and the UI, with no emojis. Categories pick from a curated set of about 75 icons, stored by key.
- **Logos:**
  - Simple Icons brand logos where they exist (HDFC, ICICI, Axis, HSBC, Paytm, PhonePe, Visa, Mastercard, Amex, Diners).
  - Banks without a logo get an initials badge in their brand colour (SBI, Kotak, Yes, IDFC FIRST, IndusInd, BoB, PNB, Canara, Union, BOI, Federal, AU, IDBI, RBL, Standard Chartered, plus "Other").
  - Any account can use an uploaded logo instead, stored on the device.
- **Accounts:** `Account { kind: bank | card | wallet | cash, name, institution, last4, subtype, network, logo, archived }`. Cash is built in.
- **Transactions, recurring items and goal entries** record `accountId` ("Paid from" / "Received in"). For bank accounts and cards they also record `via`:
  - Picking a bank or card selects UPI automatically.
  - Banks offer UPI, Swipe, Net banking and Cheque; cards offer UPI and Swipe.
- **Name:** transactions and recurring items have an optional `title` (e.g. "Lunch with team").
  - Lists show it in place of the category name when set.
  - Goal deposits and withdrawals are named after the goal.
- **Onboarding** has a step 2 for adding accounts. They can also be managed later under More → Accounts & cards.
- **Removing an account** archives it. It's hidden from new entries, but past entries keep its name and logo, and it can be restored.
- **Balances** aren't tracked yet; accounts are labels for now. Balances and transfers (e.g. paying a card bill) are the next phase.
- **Upgrades:**
  - Existing data is upgraded automatically: emoji icons become icon keys, and payment methods become an account and/or a `via`.
  - Old v1 backups still import.
