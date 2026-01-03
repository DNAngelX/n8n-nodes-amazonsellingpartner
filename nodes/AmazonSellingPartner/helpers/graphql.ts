export function minifyGraphql(query: string): string {
	if (!query) return '';
	let q = query;
	// Remove block comments /* ... */
	q = q.replace(/\/\*[\s\S]*?\*\//g, '');
	// Remove line comments # ... (but not inside strings)
	q = q.replace(/(^|\s)#[^\n]*/g, '$1');
	// Collapse whitespace
	q = q.replace(/\s+/g, ' ').trim();
	return q;
}


