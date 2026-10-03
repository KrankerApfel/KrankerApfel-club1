# KrankerApfel - Blog Statique

Système de build pour blog statique avec conversion markdown et inclusion de composants.

## Structure du projet

```
src/
├── articles/          # Articles en markdown avec frontmatter YAML (optionnel)
├── components/        # Composants réutilisables (sidebar, footer, etc.)
├── css/              # Styles globaux
├── js/               # Scripts JavaScript
├── pages/            # Pages HTML et markdown (index.md, etc.)
└── template.html     # Template de base pour toutes les pages

build/                # Site généré (créé par le build)
```

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

Le script de build :
1. Nettoie le dossier `build/`
2. Copie les assets CSS/JS
3. Traite les pages HTML et markdown avec inclusion de composants
4. Convertit les articles markdown en HTML (si le dossier existe)
5. Préserve la structure de dossiers des articles

## Watch mode (build à la volée)

```bash
npm run watch
```

Le mode watch surveille le dossier `src/` et rebuild automatiquement à chaque changement de fichier. Idéal pendant le développement.

## Template et variables

Le template `src/template.html` utilise des variables `{{nom}}` pour inclure des composants :

```html
{{sidebar}}

<main>
    <article>
    {{content}}
    </article>
</main>

{{footer}}
```

Les variables sont remplacées par le contenu de `src/components/nom.html`.

## Frontmatter des articles

Les fichiers markdown peuvent inclure un frontmatter YAML optionnel :

```yaml
---
title: "Titre de l'article"
last-update: "2026-06-23"
draft: false
---
```

- `title` : Titre de l'article (utilisé pour la balise `<title>`)
- `last-update` : Date de dernière mise à jour
- `draft` : Si `true`, l'article est ignoré au build

## Pages dans src/pages

Les fichiers dans `src/pages/` peuvent être :
- `.html` : Le contenu entre `<body>` est extrait et inséré dans `{{content}}`
- `.md` : Converti en HTML et inséré dans `{{content}}` (déjà enveloppé dans `<main><article>` dans le template)

Le dossier `src/articles/` est optionnel. S'il n'existe pas, le build continue sans erreur.
