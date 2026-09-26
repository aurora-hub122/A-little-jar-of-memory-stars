# A Little Jar of Memory Stars

A digital jar for the objects, feelings, and moments that memory makes valuable.

## Function

This website transforms the childhood tradition of keeping folded paper stars in a jar into an interactive memory archive. Visitors can open the jar and choose among eight paper stars. Each star represents an object I could not throw away; opening it reveals photographs and a handwritten story about the memory the object continues to carry.

The interaction is intentionally quiet and unhurried. Instead of ranking, recommending, or assigning a price to these objects, the website asks visitors to spend time with them and understand why they matter to one person.

The shared edition adds a small glass invitation beside the jar. Visitors can write a memory on a virtual strip of star paper, add one photograph, choose a paper color, and fold it into a star. After the shared backend is connected, these stars are stored online and can be opened by other visitors. Aurora’s original eight stars and the community collection share the same jar, with a quiet switch between them and eight community stars shown at a time.

**Setup status:** the Supabase project URL and public key have been configured and verified. The latest connection check found that the memory table has not been created and anonymous sign-ins are still disabled. Complete [SHARED-SETUP.md](SHARED-SETUP.md) before testing uploads. No local-only save is presented as a shared upload.

## Value

The undervalued value explored in this project is **sentimental value**: the idea that an object can remain valuable because of memory, emotional attachment, and lived experience, even when it has little practical or monetary worth.

The Internet often organizes attention through speed, popularity, usefulness, visibility, and profit. This project follows a different logic. Each paper star gives space to an object or moment that may appear ordinary, outdated, or disposable to someone else. Its value is not proven through numbers. It becomes visible through the time, care, and personal history held inside it.

The star jar acts as a container for that value. Just as children once filled jars with folded stars, wishes, and private thoughts, this digital jar holds memories that might otherwise be forgotten.

## Current Memories

The jar currently contains eight memories connected to:

- An Arduino project
- Childhood piano scores
- A ticket from the musical *Chicago*
- An Apple Watch
- A six-point star necklace
- Old family photographs
- A European Youth Event wristband
- A Halloween ghost plush

## Materials

The materials in this repository include:

- Photographs of personal objects, people, places, and meaningful moments
- Written recollections connected to each object
- A transparent memory-jar illustration
- HTML and CSS used to create the paper stars, handwritten letters, glass invitation, and interactions
- JavaScript for submissions, image preparation, shared browsing, and removing a visitor’s own star
- Supabase for anonymous visitor sessions, shared stories, and photo storage

Aurora’s original memories still open with HTML and CSS. The shared features require JavaScript, an Internet connection, and the Supabase setup. A browser CDN loads Supabase’s JavaScript library; no build system is required.

## Sharing and Care

Visitors explicitly agree to make their story and optional photograph public. A nickname is optional. Images are resized and re-encoded before upload. Each visitor can submit five stars in a rolling 24-hour period, up to 50 in total. The server checks these limits and ownership; Turnstile should be enabled before public use.

Visitors can remove their own stars while their anonymous session remains in the same browser. Clearing browser data or changing devices loses this access. Shared stars appear immediately; this prototype does not include a moderation queue or an account recovery system. The owner can manage submissions in Supabase. Other visitors see new stars when they select the shared collection, return to the page, or refresh it; there is no live push subscription.

## Folder Structure

- `index.html` — the website structure, memory stories, and star links
- `style.css` — the visual design, responsive layout, and CSS-only interactions
- `shared.js` — shared star interactions and Supabase integration
- `config.js` — public project URL, publishable key, and optional Turnstile site key
- `supabase-setup.sql` — database, storage bucket, ownership policies, and submission limits
- `SHARED-SETUP.md` — owner’s connection and publishing instructions
- `assets/images` — the jar illustration and photographs used throughout the archive

## Author

Aurora Feng
