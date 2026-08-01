// ============================================
// ALPHEX AI SOLUTIONS POS
// Supabase Client Helper
// ============================================

class SupabaseClient {
    constructor(url, key) {
        this.url = url;
        this.key = key;
        this.headers = {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };
    }

    async query(table, options = {}) {
        let url = `${this.url}/rest/v1/${table}`;
        const params = [];

        if (options.select) params.push(`select=${options.select}`);
        if (options.where) {
            Object.entries(options.where).forEach(([k, v]) => {
                if (v === null) params.push(`${k}=is.null`);
                else if (typeof v === 'string' && v.startsWith('like.')) params.push(`${k}=${v}`);
                else if (typeof v === 'string' && v.startsWith('gte.')) params.push(`${k}=gte.${v.slice(4)}`);
                else if (typeof v === 'string' && v.startsWith('lte.')) params.push(`${k}=lte.${v.slice(4)}`);
                else params.push(`${k}=eq.${v}`);
            });
        }
        if (options.order) params.push(`order=${options.order}`);
        if (options.limit) params.push(`limit=${options.limit}`);
        if (options.offset) params.push(`offset=${options.offset}`);

        if (params.length) url += '?' + params.join('&');

        const res = await fetch(url, { headers: this.headers });
        if (!res.ok) throw new Error(`Query failed: ${res.statusText}`);
        return await res.json();
    }

    async insert(table, data) {
        const res = await fetch(`${this.url}/rest/v1/${table}`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Insert failed');
        }
        return await res.json();
    }

    async update(table, data, where) {
        let url = `${this.url}/rest/v1/${table}?`;
        Object.entries(where).forEach(([k, v]) => url += `${k}=eq.${v}&`);
        url = url.slice(0, -1);

        const res = await fetch(url, {
            method: 'PATCH',
            headers: this.headers,
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Update failed');
        return await res.json();
    }

    async delete(table, where) {
        let url = `${this.url}/rest/v1/${table}?`;
        Object.entries(where).forEach(([k, v]) => url += `${k}=eq.${v}&`);
        url = url.slice(0, -1);

        const res = await fetch(url, {
            method: 'DELETE',
            headers: this.headers
        });
        if (!res.ok) throw new Error('Delete failed');
        return true;
    }

    async rpc(funcName, params = {}) {
        const res = await fetch(`${this.url}/rest/v1/rpc/${funcName}`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(params)
        });
        if (!res.ok) throw new Error(`RPC ${funcName} failed`);
        return await res.json();
    }
}

// Initialize client (will be configured from config.js)
let db;
function initSupabase() {
    db = new SupabaseClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}
