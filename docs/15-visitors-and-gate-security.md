# Visitors and Gate Security

Secures society boundary entries and logs non-resident vehicles/visitors.

## Pass Types
1. **Pre-Registered Passes**: Residents create a visitor profile, generate a unique pass code, and share it.
2. **Ad-hoc Gate Entry**: Guard manually registers name, CNIC, phone number, vehicle plate, and destination unit.

## Security Controls
- **Blacklist Matches**: Any entry attempt matching a blacklisted vehicle plate or visitor name triggers a visual guard alert dashboard warning.
- **Automatic Status Updates**: Passes are validated at entry terminals, updating status to `checked_in` and then `checked_out` when leaving.
