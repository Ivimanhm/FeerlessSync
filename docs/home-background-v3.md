# Fondo de portada con dos elementos laterales

Archivo: `src/frontend/public/home/background-v3.jpg`.

Generado con la herramienta integrada `image_gen`, usando `src/frontend/public/landscape.jpg` como referencia de estilo. Convertido a JPEG con calidad 90, sin cambiar la composición ni las dimensiones.

La portada, Campeones e Historial usan esta variante: una torre con fuego azul a la izquierda y un gran cristal a la derecha, con ruinas, puentes y cascadas al fondo. Las tres páginas comparten la imagen y los degradados definidos en `src/frontend/styles/global.css`, que oscurecen la zona del texto y permiten más luz en los bordes.

Opciones para comparar en la portada: `/?fondo=anterior` (paisaje original) y `/?fondo=valle` (variante v2).

## Prompt utilizado

```text
Use case: stylized-concept. Asset type: cinematic fantasy website background for a League of Legends themed landing page. Image 1 is a style reference only. Create a NEW composition, not the previous empty landscape. The user's request is an attractive atmospheric background with TWO impressive foreground landmarks framing the two sides. Widescreen 16:9, high resolution, polished hand-painted fantasy game environment art. LEFT EDGE: a tall beautifully sculpted ancient guardian watchtower in weathered dark stone with carved wing-shaped ornamentation, restrained bronze-gold trims, and a blue magical flame or gem in its crown; ivy, roots and angular stonework descending along the left border. RIGHT EDGE: an imposing ornate crystalline obelisk, a large luminous sapphire crystal set in a carved stone and bronze shrine, fractured rock terraces with subtle cyan runes and small blue plants. Both landmarks should be tall, dramatic, clearly visible, visually distinct, and occupy the OUTER 12 percent of each side; their details frame the scene without entering the text area. BACKGROUND BETWEEN THEM: a beautiful deep blue-green ancient forest valley, a winding river, a small distant broken stone bridge and layered ruined towers in soft mist, distant mountains under a textured night-blue clouded sky. Composition and readability: keep the middle 70 percent spacious and DARK, with low-contrast detail and atmosphere, especially the left-center where white and gold website headings will appear. Let the flanking landmarks be the strongest shapes. Add more visual character and depth than a plain valley, while remaining a usable UI background. Palette: rich midnight navy, muted teal and forest green, restrained cyan crystal light, warm antique gold. Lighting: soft moonlit rim lighting on the two outer landmarks, the center stays softly shadowed; visible details at the edges, no glaring glow or pale sky. Constraints: two environmental landmarks, no people, no champion characters, no text, no logo, no watermark, no user interface, no frames. Render only the background illustration, not a website screenshot.
```
