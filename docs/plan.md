# KURF: coding plan (two weeks)

## Week 1: signup and login

- Add a database (SQLite) for user accounts, with passwords stored hashed.
- Build signup, login and current-user endpoints using JWT.
- Build the signup and login pages, and put the app behind the login.
- Add a landing page after login and a logout option.
- Write automated tests for the auth endpoints.

If time allows:

- Add the CV and job description input form (the app's main inputs), so a
  logged-in user can enter what they are preparing for.

## Week 2: smart AI moderation layer

- Sits between the user and the AI so replies stay on topic, safe and honest,
  rather than passing the model's raw output straight through.
- Give the AI a clear role as a supportive interview coach.
- Filter the user's input, and check the AI's reply before it is shown.
- Use model-based judgement rather than word lists, retry on bad output, and
  refuse politely when something is blocked.
- Test it against deliberate attempts to derail or misuse it.

If time allows:

- Wire the moderation layer into a first real feature: generating likely
  interview questions from the user's CV and job description.

Both feed the Design, Implementation, and LSEPI chapters of the report.
