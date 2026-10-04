# Storybook character wardrobe

Preview: `/character-preview.html`. Built-in image generation was used (not the CLI/API fallback). All project assets are stored in this directory; no runtime dependency on the local generated-images folder.

## Assets

- `mint-parts-v1.png`: original approved mint-hoodie character, three-part atlas. Its lower body remains the base. Existing SVG contours isolate the artwork from the original halo.
- `heads-v1.png`: ten hairstyles with blank faces, 1254 × 1254.
- `features-v1.png`: ten eye pairs, ten noses, ten mouths, 1254 × 1254.
- `outfits-v1.png`: ten upper-body garments with arms and hands, 1983 × 793.
- `shoes-v1.png`: ten pairs of shoes, 1254 × 1254.

`StorybookParts.tsx` displays source-image rectangles with SVG viewports, preserving the generated alpha and painted pixels. Neck alignment is calibrated independently for the two head rows. Shoe sprites replace the original footwear and follow the existing lower-body proportions. The original body rig, grade references, and fullness controls remain available. Ten expression presets combine eyes and mouths; each facial feature is independently selectable afterward. Clothing currently changes the upper garment; navy shorts remain the base.

This is a local design preview. It does not persist choices to school accounts, replace the production avatar, or change the production shop and purchases. No deployment is included.

## Generation prompts

Reference for all images: `mint-parts-v1.png`, the approved polished painted elementary-school storybook character. Transparent background requested for every atlas. No text, branding, or grid lines. Same child-appropriate proportions and soft painted shading.

Heads: create a production sprite atlas, illustration-story, exact five-column/two-row layout. Ten front-facing heads and necks, same peach skin and blank face oval, no eyes, eyebrows, nose or mouth. Keep hair within its cell. Reading order: tousled chestnut short hair with star pin; neat black side-part; chestnut bob; black shoulder-length; brown high ponytail; chestnut twin ponytails; dark curly short; brown double buns; black braided pigtails; brown pixie. Face and neck anchors consistent, hair does not obscure the central face.

Outfits: production game modular sprite atlas matching the reference. Five columns/two rows. Ten separate front-facing child upper bodies with peach hands, relaxed A pose, no heads or legs. Neck near top, waist-length hem and hands below. Reading order: mint star hoodie; cream knit cardigan; navy varsity jacket; yellow toggle raincoat; pink heart sweatshirt; blue denim jacket; sage safari pocket shirt; lavender sailor blouse; red plaid overshirt; blue/white track jacket. Garments isolated with margins.

Shoes: production game modular sprite atlas matching the reference. Five columns/two rows, one pair per cell, front-three-quarter view symmetrically facing outward, no legs or bodies. Reading order: cream star sneakers; navy canvas low-tops; red high-top trainers; yellow ankle rain boots; brown loafers; pink Mary Janes; green hiking shoes; purple velcro sneakers; blue sandals; cream fur-lined ankle boots. Distinct silhouettes, no brands.

Features: production game modular sprite atlas matching the reference. Five columns/six rows. First two rows, ten pairs of eyes with eyebrows: warm brown round, black almond, hazel wide, happy closed arcs, left wink, sleepy half closed, surprised circles, determined angled brows, gentle downturned, delighted sparkling. Next two rows, ten noses: tiny button, round button, subtle bridge, peach triangle, upturned, soft broad, small oval, freckled button, curved tip, subtle two nostrils. Final two rows, ten mouths: small smile, open happy grin, tiny O, closed neutral, laughing with tongue, toothy grin, asymmetric smirk, gentle pout, shy smile, amazed open. Only isolated features, no heads, no skin background, no labels.

## Source provenance

Built-in generated image IDs: heads `exec-e084a6a9-e93d-4872-a6e5-3ac2a275fdb7`; outfits `exec-9481fa87-8ee6-43fc-8f94-8ab1e630053d`; shoes `exec-d7f9c1b1-87be-45c7-8582-2e6268e52684`; features `exec-bd72f152-2c18-4444-90bb-182307173d3e`.


## Preview updates
- Seven independent categories: hair, eyes, nose, mouth, tops, bottoms, shoes (10 each). Expression presets removed; facial features remain independently selectable.
- Nose sprites enlarged and raised; mouth silhouettes use individual dimensions. Face categories open a close-up preview.
- lower-bodies-v2.png: generated integrated shorts/legs/footwear atlas, with source-space silhouette clipping to exclude retained background.
- bottoms-v1.png: generated five trousers/shorts and five skirts, overlaid at the shared waist anchor.
- Both new atlases were generated with imagegen using the existing soft painted child style; lower-body extraction was an imagegen edit.
- Preview only; school-account persistence and production integration are not included.

## Rounded noses v2
Asset: noses-v2.png. Built-in imagegen, existing features-v1.png as style reference. Prompt: ten isolated front-facing child nose tips, 5 columns by 2 rows, transparent background, warm soft painted style; rounded low-profile tips, no bridge, no triangular outline or pointed apex, gentle peach shading and subtle nostrils. SVG display preserves the face anchor and reduces vertical projection.

## Heads v2
Saved asset: heads-v2.png (1774 x 887). Generated using built-in imagegen with heads-v1.png as reference. Prompt: remake ten blank-faced child heads, five columns by two rows, separate complete hairstyles with transparent gutters, consistent peach skin and face/neck anchors; short tousled, side part, bob, long, ponytail, twin ponytails, curly, double buns, braids, pixie; no outlines or labels. Runtime now uses per-head transparent source rectangles and individual chin/neck anchors instead of rough silhouette cuts. Face zoom includes extra space above high hairstyles.

## October 4 alignment and recoloring repair
- heads-v3.png: built-in imagegen, new generation with ten small isolated blank-faced heads, 5 columns/2 rows, each occupying only half a cell width, wide transparent gutters, consistent peach skin, no face features. Original output exec-55161d37-6a91-4400-b851-43c760be8b2d.png. Visible head bounds were measured from alpha and confirmed to lie inside the source rectangles.
- noses-v3.png: built-in imagegen, ten front-facing child noses with short softly fading nasal bridges, rounded tips, peach shading, no triangular contour. Original output exec-b8ede2d5-6edf-4e96-8da3-8a84d7933102.png. Runtime brightness/saturation/opacity matches face tone.
- Atlas sprites and bottoms use explicit group transforms with source-space clips, avoiding nested SVG viewport sizing. All clothing remains drawn when switching collections.
- Eye sprites are 82% of previous size; pupil-center spacing is 97% for sparkling eyes, 85% for smiling eyes, 94% for the others. Eye line raised 8 local units. Nose/mouth use optical center anchors.
- Shoe recoloring clips to shoe contours only; outfit recoloring excludes neck/hands. Raw skin remains unfiltered.
- character-check.html provides development-only visual comparison of ten choices per category for each collection.


## Account and shop integration

The signed-in student map now opens StorybookStudio in the character and fashion-shop dialogs. Appearance (four face shapes, facial features, collection and body proportions) is stored in the student's existing avatar document under `storybook`. Saving updates the map toolbar and profile. The standalone character-preview page remains an unsaved design playground and links back to sign-in.

Basic index 0 in each clothing category is free. The shop offers 72 additional collection-specific designs: hair 12, upper garments 18, bottoms 12 and shoes 10 school currency units each (100 minor units per unit). Purchases use the existing atomic ledger and immutable ownership receipts. Firestore validates prices, ownership and shape bounds. Legacy appearance and purchased items remain available through the existing-character tab; saving that appearance switches back to the legacy renderer.
