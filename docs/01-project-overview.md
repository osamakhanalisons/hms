# Project Overview

AT-BMS (HousingOS) is a state-of-the-art, multi-tenant portal designed to streamline operations, finance, and security workflows within gated communities, housing societies, and commercial complexes.

## Business Goals
1. **Financial Transparency**: Provide real-time ledger access to residents to reduce disputes.
2. **Tenant Isolation**: Maintain absolute data privacy between different housing societies using the same platform instance.
3. **Operational Efficiency**: Provide tools to log complaints, handle parking allocations, and track maintenance bills.
4. **Security Hardening**: Secure entry/exit tracking and prevent unauthorized users from viewing adjacent society records.

## Core Concepts Explained

### 1. Society / Tenant
* **Technical definition**: The top-level administrative unit (represented in the `tenants` database table).
* **Roman Urdu**: *Ye poori housing society ya building cooperative hai (jaise Green Pines Society). Har society ka data doosri society se bilkul alag rehta hai.*

### 2. Block
* **Technical definition**: A spatial cluster within a tenant (e.g., Block A, Phase II).
* **Roman Urdu**: *Society ke andar ka area ya sector (jaise Block A). Ye building ya units ko grouping dene ke liye use hota hai.*

### 3. Building
* **Technical definition**: A physical structure inside a Block containing vertical levels.
* **Roman Urdu**: *Block ke andar majood physical building ya tower (jaise Tower 1). Blocks ke baghair buildings directly society level par bhi ho sakti hain.*

### 4. Floor
* **Technical definition**: A vertical index mapping inside a building.
* **Roman Urdu**: *Building ki floors (jaise Ground Floor, First Floor). Units ko height ke mutabiq classify karne ke liye.*

### 5. Unit
* **Technical definition**: A specific apartment, flat, penthouse, shop, or villa (represented in the `units` table).
* **Roman Urdu**: *Woh flat ya ghar jisme rehne wala shakhs rehta hai. Ye billing aur ownership ki aakhri limit hai.*

### 6. Resident
* **Technical definition**: An occupant of a unit, classified as Owner or Tenant.
* **Roman Urdu**: *Woh shakhs jo unit me reh raha hai. Iska data profiles table me save hota.*

### 7. Society Admin
* **Technical definition**: An administrator scoped to one or more tenants via `society_admin_tenants`.
* **Roman Urdu**: *Society ka manager jo sirf apni society ke members, billing, aur complaints ko manage kar sakta hai.*

### 8. Super Admin
* **Technical definition**: A global platform admin with global bypass.
* **Roman Urdu**: *Platform owner jo poore system ko monitor karta hai, nai societies banata hai, aur unhe system modules assign karta hai.*
