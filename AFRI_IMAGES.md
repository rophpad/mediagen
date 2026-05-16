# Afri: generer et modifier des images

Cette note est une synthese pratique de la documentation publique de Build with AFRI (`https://build.lewisnote.com/documentation`) pour les usages image. Elle ne depend pas du code actuel du depot.

## Base API

- Base URL: `https://build.lewisnote.com/v1`
- Authentification: header `Authorization: Bearer <AFRI_API_KEY>`
- Type de cle: `sk-afri-...`
- Positionnement officiel: API compatible OpenAI pour la partie `v1`

Exemple d'environnement local:

```bash
export AFRI_API_KEY='votre_cle_sk-afri'
export AFRI_BASE_URL='https://build.lewisnote.com/v1'
```

## Modeles image documentes

### `gpt-image-1.5`

- Usage: generation et edition d'images haute qualite depuis un prompt ou une image source
- Endpoint de generation: `POST /images/generations`
- Endpoint d'edition: `POST /images/edits`
- Prix annonce: `$0.009` a `$0.200` par image
- Parametres documentes:
  - `prompt` string, requis
  - `size` string: `1024x1024`, `1536x1024`, `1024x1536`, `auto`
  - `quality` string: `low`, `medium`, `high`
  - `background` string: `opaque` ou `transparent`
  - `output_format` string: `png` ou `webp`

### `gpt-image-2`

- Usage: generation et edition d'images avec meilleure comprehension des prompts
- Endpoint de generation: `POST /images/generations`
- Endpoint d'edition: `POST /images/edits`
- Prix annonce: `$0.009` a `$0.200` par image
- Parametres documentes:
  - `prompt` string, requis
  - `size` string: `1024x1024`, `1280x720`, `720x1280`, `1536x1024`, `1024x1536`
  - `quality` string: `low`, `medium`, `high`

### `flux-2-klein`

- Usage: generation rapide, iteration creative, edition legere
- Endpoint unique: `POST /images/flux`
- Prix annonce: `$0.02` par image
- Parametres documentes:
  - `prompt` string, requis
  - `width` number, maximum `1024`
  - `height` number, maximum `1024`
  - `steps` number, entre `4` et `50`
  - `image` string: image encodee en base64 pour l'edition

## Generer une image

### cURL avec `gpt-image-2`

```bash
curl "$AFRI_BASE_URL/images/generations" \
  -H "Authorization: Bearer $AFRI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-2",
    "prompt": "Clean product photo of a handmade bag on white background",
    "size": "1536x1024",
    "quality": "medium"
  }'
```

### cURL avec `gpt-image-1.5` et fond transparent

```bash
curl "$AFRI_BASE_URL/images/generations" \
  -H "Authorization: Bearer $AFRI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-1.5",
    "prompt": "Flat illustration of a fintech dashboard for mobile, clean and minimal",
    "size": "1024x1024",
    "quality": "high",
    "background": "transparent",
    "output_format": "png"
  }'
```

### JavaScript `fetch`

```ts
const response = await fetch("https://build.lewisnote.com/v1/images/generations", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.AFRI_API_KEY}`,
  },
  body: JSON.stringify({
    model: "gpt-image-2",
    prompt: "A modern classroom in Cotonou, natural light",
    size: "1024x1024",
    quality: "high",
  }),
});

const data = await response.json();
console.log(data);
```

## Modifier une image avec GPT Image

La documentation publique Afri indique explicitement d'utiliser `POST /v1/images/edits` pour l'edition des modeles GPT Image. En revanche, la page publique ne detaille pas encore le schema complet du formulaire. En pratique, Afri se presente comme compatible OpenAI sur `v1`, donc le flux suivant est le plus coherent a utiliser:

- envoyer un `multipart/form-data`
- fournir `model`, `prompt` et `image`
- ajouter `size` et `quality` si necessaire

### cURL d'edition

```bash
curl "$AFRI_BASE_URL/images/edits" \
  -H "Authorization: Bearer $AFRI_API_KEY" \
  -F "model=gpt-image-2" \
  -F "prompt=Replace the background with a warm studio setup and keep the bag unchanged" \
  -F "size=1536x1024" \
  -F "quality=medium" \
  -F "image=@./input.png"
```

### JavaScript `fetch` avec `FormData`

```ts
const formData = new FormData();
formData.append("model", "gpt-image-2");
formData.append("prompt", "Remove the table and place the product on a clean white background");
formData.append("size", "1536x1024");
formData.append("quality", "medium");
formData.append("image", fileInput.files[0]);

const response = await fetch("https://build.lewisnote.com/v1/images/edits", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.AFRI_API_KEY}`,
  },
  body: formData,
});

const data = await response.json();
console.log(data);
```

## Generer ou modifier rapidement avec FLUX

### Generation FLUX

```bash
curl "$AFRI_BASE_URL/images/flux" \
  -H "Authorization: Bearer $AFRI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A futuristic city at night",
    "width": 1024,
    "height": 1024,
    "steps": 25
  }'
```

### Edition FLUX avec image base64

```ts
import { readFile } from "node:fs/promises";

const imageBase64 = (await readFile("./input.png")).toString("base64");

const response = await fetch("https://build.lewisnote.com/v1/images/flux", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.AFRI_API_KEY}`,
  },
  body: JSON.stringify({
    prompt: "Turn this photo into a clean poster-style illustration",
    width: 1024,
    height: 1024,
    steps: 25,
    image: imageBase64,
  }),
});

const data = await response.json();
console.log(data);
```

Note: la doc publique decrit `image` comme une image base64. Si votre compte attend un autre encodage exact, verifiez la reponse d'erreur du endpoint et adaptez ce champ.

## Reponses API

La documentation publique visible ne detaille pas encore la structure JSON de reponse pour les endpoints image. Pour eviter un parse fragile:

- journalisez la premiere reponse brute en environnement de test
- verifiez si Afri vous renvoie une URL, un tableau `data`, ou un autre format image
- ne figez pas le parse avant d'avoir observe une vraie reponse de votre compte

Exemple defensif en JavaScript:

```ts
const data = await response.json();
console.log(JSON.stringify(data, null, 2));
```

## Resume pratique

- Pour generer avec les modeles GPT Image: `POST /images/generations`
- Pour modifier avec les modeles GPT Image: `POST /images/edits`
- Pour generer vite avec FLUX: `POST /images/flux`
- Pour modifier avec FLUX: `POST /images/flux` avec un champ `image` en base64
- Base URL a utiliser partout: `https://build.lewisnote.com/v1`

## Limites de cette note

- Elle s'appuie sur la documentation publique Afri disponible le `2026-05-16`
- Je n'ai pas lance d'appel payant sur votre compte pour valider les reponses runtime
- Je n'ai pas enregistre votre cle API dans ce depot
