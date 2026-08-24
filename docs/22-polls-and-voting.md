# Polls and Voting

Conducts society-wide surveys and binding voting resolutions.

## Structure
- **Question Details**: Question text, options list (JSON representation).
- **Time Limits**: Set active start and end dates.
- **Validation**: System enforces single-vote constraints by checking the unique user identifier against the `poll_votes` table.
- **Anonymous Option**: Voting can be configured as anonymous to protect privacy.
