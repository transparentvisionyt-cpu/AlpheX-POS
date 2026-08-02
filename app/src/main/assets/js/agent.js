// ============================================
// AlpheX POS - AI Business Assistant
// GTA Concrete Pumping
// ============================================

const AGENT = {
    apiKey: '',
    chatHistory: [],
    businessContext: ''
};

// ===== INIT =====
function initAgent() {
    const saved = JSON.parse(localStorage.getItem('alpex_config') || '{}');
    AGENT.apiKey = saved.geminiKey || '';
    
    AGENT.businessContext = `You are a smart Business Assistant for GTA Concrete Pumping, a concrete pumping company in York, Ontario, Canada.

BUSINESS DETAILS:
- Company: GTA Concrete Pumping
- Address: 2578 St Clair Ave, York, ON M6N 1L8, Canada
- Phone: +1 6477789872
- Industry: Concrete Pumping & Construction Services
- Location: Greater Toronto Area (GTA), Ontario, Canada

YOUR ROLE:
- Help with sales analysis and reporting
- Suggest inventory management improvements
- Provide pricing and profit optimization tips
- Give customer relationship advice
- Share concrete pumping business insights
- Help with growth strategies
- Answer any business-related questions

RULES:
- Be concise and actionable
- Give specific numbers and percentages when possible
- Use dollar amounts in CAD ($)
- Be professional but friendly
- If asked about data you don't have, say "I can help you analyze that — go to Reports section for detailed data"
- Always relate advice back to concrete pumping industry when possible`;
}

// ===== CHAT UI =====
function openAgentChat() {
    document.getElementById('agentPanel').classList.add('open');
    document.getElementById('agentInput').focus();
    if (!AGENT.apiKey) {
        // Load from config.js
        AGENT.apiKey = CONFIG?.SUPABASE_ANON_KEY ? '' : '';
        // Try to get Gemini key from settings
        const settings = JSON.parse(localStorage.getItem('alpex_config') || '{}');
        AGENT.apiKey = settings.geminiKey || '';
    }
    if (!AGENT.apiKey) {
        addAgentMsg('bot', '⚠️ To use the AI Assistant, please add your Gemini API key in Settings. Get a free key at aistudio.google.com/apikey');
    }
}

function closeAgentChat() { document.getElementById('agentPanel').classList.remove('open'); }

function addAgentMsg(role, text) {
    const el = document.getElementById('agentMessages');
    const div = document.createElement('div');
    div.className = `agent-msg ${role}`;
    div.innerHTML = `
        <div class="agent-msg-avatar">${role === 'bot' ? '🤖' : '👤'}</div>
        <div class="agent-msg-bubble">${formatAgentMsg(text)}</div>
    `;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
}

function showAgentTyping() {
    const el = document.getElementById('agentMessages');
    const div = document.createElement('div');
    div.className = 'agent-msg bot';
    div.id = 'agentTyping';
    div.innerHTML = `
        <div class="agent-msg-avatar">🤖</div>
        <div class="agent-msg-bubble">
            <div class="agent-msg-typing"><span></span><span></span><span></span></div>
        </div>
    `;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
}

function removeAgentTyping() {
    document.getElementById('agentTyping')?.remove();
}

function formatAgentMsg(text) {
    if (!text) return '';
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/`([^`]+)`/g, '<code style="background:rgba(99,102,241,.15);padding:2px 6px;border-radius:4px">$1</code>');
    text = text.replace(/\n/g, '<br>');
    return text;
}

// ===== SEND MESSAGE =====
async function sendAgentMsg() {
    const inp = document.getElementById('agentInput');
    const text = inp.value.trim();
    if (!text) return;
    
    inp.value = '';
    addAgentMsg('user', text);
    AGENT.chatHistory.push({ role: 'user', content: text });
    
    showAgentTyping();
    
    try {
        // Get live business data
        const businessData = await getBusinessData();
        const contextWithData = AGENT.businessContext + '\n\nCURRENT BUSINESS DATA:\n' + businessData;
        
        let response;
        if (AGENT.apiKey) {
            response = await callGeminiAgent(contextWithData);
        } else {
            response = getLocalResponse(text);
        }
        
        removeAgentTyping();
        addAgentMsg('bot', response);
        AGENT.chatHistory.push({ role: 'assistant', content: response });
    } catch (e) {
        removeAgentTyping();
        addAgentMsg('bot', '⚠️ Error: ' + e.message + '\n\n💡 Quick tip: Go to Reports section for business insights!');
    }
}

// ===== GEMINI API =====
async function callGeminiAgent(systemPrompt) {
    const messages = AGENT.chatHistory.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
    }));
    
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${AGENT.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: messages,
            generationConfig: { temperature: 0.7 }
        })
    });
    
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'API error');
    }
    
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
}

// ===== LOCAL FALLBACK =====
function getLocalResponse(text) {
    const lower = text.toLowerCase();
    
    if (lower.includes('sale') || lower.includes('revenue') || lower.includes('money')) {
        return '📊 **Sales Insights**\n\nGo to **Reports** section for detailed sales analysis. Key things to track:\n- Daily revenue trends\n- Top selling products/services\n- Customer purchase patterns\n\nTip: Aim for 10-15% month-over-month growth in revenue.';
    }
    if (lower.includes('inventory') || lower.includes('stock')) {
        return '📦 **Inventory Tips**\n\nCheck **Inventory** section for:\n- Low stock alerts\n- Stock value analysis\n- Reorder recommendations\n\nRule of thumb: Keep 2-3 weeks of stock for high-demand items. Set min stock levels to avoid stockouts.';
    }
    if (lower.includes('price') || lower.includes('pricing') || lower.includes('profit')) {
        return '💰 **Pricing Strategy**\n\nFor concrete pumping services:\n- Monitor competitor pricing in GTA area\n- Factor in fuel costs + equipment depreciation\n- Consider volume discounts for large projects\n- Aim for 30-40% gross margin on materials\n\nUpdate prices quarterly based on market conditions.';
    }
    if (lower.includes('customer') || lower.includes('client')) {
        return '👥 **Customer Management**\n\nUse the **Customers** section to:\n- Track loyalty points (1 point per $100 spent)\n- Monitor customer visit frequency\n- Identify VIP customers\n- Follow up with inactive customers\n\nTip: Personalized follow-ups increase repeat business by 40%.';
    }
    if (lower.includes('concrete') || lower.includes('pump')) {
        return '🏗️ **Concrete Pumping Business Tips**\n\nGTA Concrete Pumping can grow by:\n- Partnering with local contractors & builders\n- Offering emergency/weekend services at premium rates\n- Maintaining equipment for minimal downtime\n- Building relationships with property developers\n- Listing on Google My Business for local SEO\n\nPeak season: May-October in Ontario. Prepare inventory accordingly.';
    }
    if (lower.includes('growth') || lower.includes('expand') || lower.includes('grow')) {
        return '📈 **Growth Strategies**\n\n1. **Digital Presence**: Google My Business, website, social media\n2. **Partnerships**: Local contractors, real estate developers\n3. **Services**: Add delivery, emergency pumping, consulting\n4. **Area**: Expand beyond York to Mississauga, Brampton, Markham\n5. **Fleet**: Add more pump trucks for capacity\n\nTarget: 20% revenue growth in next 12 months.';
    }
    
    return '🤖 I can help with:\n\n📊 Sales & Revenue analysis\n📦 Inventory management\n💰 Pricing & Profit tips\n👥 Customer relationships\n🏗️ Concrete pumping business advice\n📈 Growth strategies\n\nTry asking about any of these topics! Or go to **Reports** for detailed business data.';
}

// ===== GET LIVE DATA =====
async function getBusinessData() {
    try {
        if (typeof db === 'undefined' || !db) return 'Database offline';
        
        const [products, orders, customers] = await Promise.all([
            db.query('products', { select: 'name,stock_quantity,sale_price,min_stock', where: { active: true } }),
            db.query('orders', { select: 'total_amount,created_at,order_type', where: { order_type: 'SALE', status: 'completed' }, order: 'created_at.desc', limit: 30 }),
            db.query('contacts', { select: 'name,total_spent,loyalty_points', where: { type: 'customer' } })
        ]);
        
        const totalProducts = products.length;
        const lowStock = products.filter(p => p.stock_quantity <= p.min_stock).length;
        const outOfStock = products.filter(p => p.stock_quantity <= 0).length;
        const totalRevenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
        const totalCustomers = customers.length;
        const topCustomer = customers.sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0))[0];
        
        return `Products: ${totalProducts} (${lowStock} low stock, ${outOfStock} out of stock)
Recent Orders: ${orders.length}
Total Revenue: $${totalRevenue.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
Total Customers: ${totalCustomers}
${topCustomer ? `Top Customer: ${topCustomer.name} ($${(topCustomer.total_spent || 0).toFixed(2)} spent)` : ''}`;
    } catch (e) {
        return 'Unable to fetch live data';
    }
}

// ===== INIT ON LOAD =====
document.addEventListener('DOMContentLoaded', initAgent);
