# Kilix Image Search V5 – incremental visual re-ranking

This upgrade keeps the existing semantic image-search pipeline intact:

1. Query image is prepared in the existing screen.
2. `embed-image` still creates the 768-D semantic query embedding.
3. pgvector still retrieves current-version candidates.
4. Missing/legacy products are still indexed on demand.
5. The top semantic candidates are optionally re-ranked by a second visual pass using Qwen VLM.
6. If visual re-ranking fails or returns no scores, the original semantic order is preserved.
7. Archived products remain filtered at every result boundary.

No database schema change is required for this incremental layer.
