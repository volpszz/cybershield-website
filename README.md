# CyberShield

Responsive landing page for CyberShield, a fictional business cybersecurity company. The current version is a static HTML and CSS site; it does not yet include JavaScript, dependencies, or a backend.

## Preview locally

From the project directory, start a static server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser. Press `Ctrl+C` in the terminal to stop the server.

## Project structure

```text
.
├── index.html
├── css/
│   └── style.css
└── img/
    └── data-center-unsplash.jpg
```

## Current features

- Responsive header and navigation.
- Hero section with a two-column desktop layout and a stacked mobile layout.
- Locally stored data-center image with descriptive alternative text.
- Responsive grid with four product cards.
- Styled contact section and footer.
- Visible keyboard focus states.

The Email, WhatsApp, and Discord buttons are visual placeholders and are not connected to actions yet.

## Planned next steps

1. Learn JavaScript by adding small interactions to this site.
2. Implement the contact-section interactions.
3. Plan email-and-password authentication with a backend or a suitable authentication service.
4. Evaluate cryptography only for a clearly defined use case; do not implement custom cryptography.
5. Consider TypeScript after learning the JavaScript fundamentals.

## Credits

The data-center photo in `img/data-center-unsplash.jpg` is by Kevin Ache via Unsplash.
