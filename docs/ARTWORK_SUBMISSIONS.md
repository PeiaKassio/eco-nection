# Artwork Submissions

We welcome contributions to our artwork data collection! If you have an idea for an artwork to include, you can submit it by making a pull request (PR) with your proposed addition. Follow the steps below to get started.

---

## How to Submit an Artwork

1. **Fork this Repository**  
   - Click the "Fork" button on the top-right corner of this repository to create a copy under your own GitHub account.

2. **Clone Your Fork Locally**  
   - Clone your fork to your local machine:
     ```bash
     git clone https://github.com/<your-username>/eco-nection.git
     cd eco-nection
     ```

3. **Add Your Artwork to the JSON File**  
   - Open the `data/artwork-data.json` file in your favorite code editor.
   - Add your proposed artwork following the GeoJSON-compatible Eco:nection format:
     ```json
     {
       "type": "Feature",
       "geometry": { "type": "Point", "coordinates": [longitude, latitude] },
       "properties": {
         "title": "Artwork Title",
         "description": "Brief description of the artwork.",
         "artist": "Artist Name",
         "location": "City, Country",
         "year": 2023,
         "tags": {
           "topic": ["Topic 1", "Topic 2"],
           "artform": ["Artform 1", "Artform 2"]
         },
         "url": "https://example.org/source",
         "thumbnail": "https://example.org/image.jpg",
         "sources": [
           {
             "url": "https://example.org/source",
             "type": "source",
             "accessed_at": "YYYY-MM-DD"
           }
         ],
         "review": {
           "status": "needs_review",
           "human_verified": false
         }
       }
     }
     ```
   - Make sure your entry is valid JSON and follows the same structure as existing entries.
   - `url` is treated as the primary source URL. Missing source URLs are allowed for publication, but they will be listed for later provenance review.
   - New submissions should use the numeric start year in `year`. For ongoing works, use the start year only.

4. **Commit Your Changes**  
   - After adding your entry, commit the changes:
     ```bash
     git add data/artwork-data.json
     git commit -m "Added new artwork: [Artwork Title]"
     ```

5. **Push Your Changes**  
   - Push your changes to your forked repository:
     ```bash
     git push origin main
     ```

6. **Create a Pull Request**  
   - Go to your forked repository on GitHub.
   - Click the "Pull Request" button.
   - Ensure the base repository is set to `PeiaKassio/eco-nection` and the base branch is `main`.
   - Add a title and description for your PR, then submit it.

---

## Pull Request Guidelines

- **Be Specific:** Include a detailed description in your pull request about the added artwork.
- **Formatting:** Ensure your JSON follows the correct structure and is formatted properly.
- **Multiple Artworks:** If you're adding multiple artworks, group them into a single pull request for easier review.
- **Respect Artistic Integrity:** Make sure you have permission to add details about any artwork that is not your own.

---

## Questions or Issues?

If you encounter any problems while submitting your pull request, feel free to [open an issue](https://github.com/PeiaKassio/eco-nection/issues) in this repository, and we'll assist you as soon as possible.

---

Thank you for contributing to our project! 🎨🌍
