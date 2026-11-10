import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const mount = document.getElementById('vendorList');
const apiBase = mount.dataset.apiBase;

function money(cents) {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP'
    }).format(Number(cents || 0) / 100);
}

function ProductItem({ product, onAdd, orderable }) {
    const [quantity, setQuantity] = useState(1);
    const stock = Number(product.stock);
    const canOrderProduct = orderable && !product.is_sample;

    return (
        <div className="shop-product">
            {product.image_url && (
                <img className="shop-product-image" src={product.image_url} alt={product.name} loading="lazy" />
            )}
            <div className="shop-product-copy">
                <strong>{product.name}</strong>
                {product.description && <small>{product.description}</small>}
                <span>{money(product.price_cents)} · {stock} in stock</span>
                {!canOrderProduct && <small className="sample-product-status">Sample listing — not currently orderable</small>}
            </div>
            <div className="shop-product-actions">
                <input
                    aria-label={'Quantity for ' + product.name}
                    data-product-control="true"
                    type="number"
                    min="1"
                    max={stock}
                    value={quantity}
                    disabled={stock < 1 || !canOrderProduct}
                    onChange={(event) => {
                        const next = Number(event.target.value);
                        setQuantity(Math.min(stock, Math.max(1, next || 1)));
                    }}
                />
                <button
                    className="vendor-action"
                    data-product-control="true"
                    type="button"
                    disabled={stock < 1 || !canOrderProduct}
                    onClick={() => onAdd(product, quantity)}
                >
                    {!canOrderProduct ? 'Not orderable' : stock ? 'Add' : 'Out of stock'}
                </button>
            </div>
        </div>
    );
}

function VendorCard({ vendor, savedIds, canMessage, cart, onAddToCart }) {
    const [expanded, setExpanded] = useState(false);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [loaded, setLoaded] = useState(false);
    const id = String(vendor.id);
    const saved = savedIds.has(id);

    const loadProducts = useCallback(async (signal) => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch(
                apiBase + '/products?vendor_id=' + encodeURIComponent(id),
                { credentials: 'same-origin', headers: { Accept: 'application/json' }, signal }
            );
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Products could not be loaded.');
            }
            setProducts(Array.isArray(result.products) ? result.products : []);
            setLoaded(true);
        } catch (requestError) {
            if (requestError.name !== 'AbortError') {
                setError(requestError.message || 'Products could not be loaded.');
            }
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (!expanded) return undefined;
        const controller = new AbortController();
        loadProducts(controller.signal);
        const refresh = () => loadProducts(controller.signal);
        window.addEventListener('pwesto:products-updated', refresh);
        return () => {
            controller.abort();
            window.removeEventListener('pwesto:products-updated', refresh);
        };
    }, [expanded, loadProducts]);

    const vendorCart = cart?.vendorId === id ? cart : null;

    return (
        <article className="vendor-card" data-vendor={id} key={id}>
            <span className="vendor-image-wrap">
                <img
                    className="vendor-image"
                    src={vendor.image || ''}
                    alt={'Sample ' + vendor.category.toLowerCase() + ' market photo for ' + (vendor.stall_code || vendor.name) + '; not a confirmed photo of this stall'}
                    title="Sample market photo — not a confirmed photo of this stall"
                    loading="lazy"
                />
                {vendor.is_sample_image && <small>Sample photo</small>}
            </span>
            <div className="vendor-main">
                <h3>{vendor.name}</h3>
                {vendor.stall_code && <span className="vendor-stall-code">{vendor.stall_code}</span>}
                <div className="vendor-category">{vendor.category} · {vendor.market}</div>
                <div className="vendor-meta">
                    <span className="stars">★ {vendor.rating}</span>
                    <span>{vendor.distance} away</span>
                </div>
            </div>
            <span className="vendor-card-actions">
                {vendor.can_message && canMessage && (
                    <button className="vendor-message-action" data-message-vendor={id} type="button">
                        Message
                    </button>
                )}
                <button
                    className="vendor-action"
                    data-action={saved ? 'unsave' : 'save'}
                    data-id={id}
                    aria-label={saved ? 'Remove saved stall' : 'Save stall'}
                    type="button"
                >
                    {saved ? '♥ Saved' : '♡ Save'}
                </button>
            </span>
            <section className="vendor-products" data-product-control="true" aria-label={'Products from ' + vendor.name}>
                <button
                    className="product-toggle"
                    data-product-control="true"
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpanded((value) => !value)}
                >
                    {expanded ? 'Hide products' : 'Choose products'}
                    {loaded && ' (' + products.length + ')'}
                </button>
                {expanded && (
                    <div className="vendor-products-list">
                        {!vendor.can_message && (
                            <p className="sample-catalog-note">
                                Sample catalog only. Prices and stock are illustrative, not vendor-confirmed; real orders require an approved vendor.
                            </p>
                        )}
                        {loading && <p className="shop-message">Loading products…</p>}
                        {error && <p className="shop-message shop-error">{error}</p>}
                        {!loading && !error && !products.length && (
                            <p className="shop-message">This vendor has not added products yet.</p>
                        )}
                        {!loading && products.map((product) => (
                            <ProductItem
                                key={product.id}
                                product={product}
                                orderable={Boolean(vendor.can_order)}
                                onAdd={(item, quantity) => onAddToCart(vendor, item, quantity)}
                            />
                        ))}
                        {vendorCart && (
                            <small className="shop-vendor-cart">
                                {vendorCart.items.reduce((total, item) => total + item.quantity, 0)} item(s) in your cart
                            </small>
                        )}
                    </div>
                )}
            </section>
        </article>
    );
}

function ShoppingCart({ cart, onQuantityChange, onRemove, onClear, onPlaceOrder, busy, error, deliveryMethod, onDeliveryMethodChange, paymentMethod, onPaymentMethodChange, deliveryAddress, onDeliveryAddressChange, pickupAt, onPickupAtChange }) {
    if (!cart || !cart.items.length) return null;
    const total = cart.items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const minimumPickupAt = now.toISOString().slice(0, 16);

    return (
        <section className="product-cart" aria-label="Shopping cart">
            <div className="product-cart-heading">
                <div><strong>Your cart</strong><small>Order from {cart.vendorName}</small></div>
                <button className="text-button" type="button" data-product-control="true" onClick={onClear}>Clear</button>
            </div>
            {cart.items.map((item) => (
                <div className="cart-item" key={item.product_id}>
                    <span><strong>{item.name}</strong><small>{money(item.price_cents)} each</small></span>
                    <div className="cart-item-actions">
                        <button type="button" data-product-control="true" aria-label={'Decrease ' + item.name} onClick={() => onQuantityChange(item.product_id, -1)}>−</button>
                        <span>{item.quantity}</span>
                        <button type="button" data-product-control="true" aria-label={'Increase ' + item.name} onClick={() => onQuantityChange(item.product_id, 1)}>+</button>
                        <button className="cart-remove" type="button" data-product-control="true" onClick={() => onRemove(item.product_id)}>Remove</button>
                    </div>
                </div>
            ))}
            <div className="product-cart-total"><span>Order total</span><strong>{money(total)}</strong></div>
            <label className="shop-delivery-field">
                Fulfillment
                <select data-product-control="true" value={deliveryMethod} onChange={(event) => {
                    const nextMethod = event.target.value;
                    onDeliveryMethodChange(nextMethod);
                    onPaymentMethodChange(nextMethod === 'pickup'
                        ? (paymentMethod === 'cash_to_vendor' ? 'cash_on_pickup' : paymentMethod)
                        : (paymentMethod === 'cash_on_pickup' ? 'cash_to_vendor' : paymentMethod));
                }}>
                    <option value="pickup">Pickup at the stall</option>
                    <option value="delivery">Delivery</option>
                </select>
            </label>
            <label className="shop-delivery-field">
                Payment
                <select data-product-control="true" value={paymentMethod} onChange={(event) => onPaymentMethodChange(event.target.value)}>
                    {deliveryMethod === 'pickup'
                        ? <option value="cash_on_pickup">Pay in cash at pickup</option>
                        : <option value="cash_to_vendor">Pay directly to the vendor</option>}
                    <option value="gcash">Xendit checkout · GCash</option>
                </select>
            </label>
            {deliveryMethod === 'pickup' && (
                <label className="shop-delivery-field">
                    Pickup date and time (Philippine time)
                    <input data-product-control="true" type="datetime-local" required min={minimumPickupAt} value={pickupAt} onChange={(event) => onPickupAtChange(event.target.value)} />
                </label>
            )}
            {deliveryMethod === 'delivery' && (
                <label className="shop-delivery-field">
                    Delivery address
                    <textarea data-product-control="true" rows="3" maxLength="500" required value={deliveryAddress} onChange={(event) => onDeliveryAddressChange(event.target.value)} placeholder="House number, street, barangay, city" />
                </label>
            )}
            {error && <p className="shop-message shop-error">{error}</p>}
            <p className="shop-payment-note">{paymentMethod === 'gcash'
                ? 'Continue to Xendit hosted checkout to pay with GCash. After payment is confirmed, the vendor receives your order and a payment email.'
                : deliveryMethod === 'delivery'
                    ? 'The vendor will contact you to confirm delivery details and fees. Pay the vendor directly.'
                    : 'Submit your order now; pay the vendor in cash when you pick up your products.'}</p>
            <button className="button button-primary product-place-order" type="button" data-product-control="true" disabled={busy} onClick={onPlaceOrder}>
                {busy ? 'Submitting order…' : 'Place order'}
            </button>
        </section>
    );
}

function VendorList({ vendors, savedIds, canMessage }) {
    const [cart, setCart] = useState(null);
    const [cartError, setCartError] = useState('');
    const [busy, setBusy] = useState(false);
    const [deliveryMethod, setDeliveryMethod] = useState('pickup');
    const [paymentMethod, setPaymentMethod] = useState('cash_on_pickup');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [pickupAt, setPickupAt] = useState('');

    function addToCart(vendor, product, quantity) {
        const vendorId = String(vendor.id);
        if (cart && cart.vendorId !== vendorId) {
            setCartError('Place or clear your current cart before choosing products from another vendor.');
            return;
        }
        setCartError('');
        setCart((current) => {
            const next = current || { vendorId, vendorName: vendor.name, items: [] };
            const existing = next.items.find((item) => item.product_id === product.id);
            if (existing) {
                return {
                    ...next,
                    items: next.items.map((item) => item.product_id === product.id
                        ? { ...item, quantity: Math.min(Number(product.stock), item.quantity + quantity) }
                        : item)
                };
            }
            return {
                ...next,
                items: [...next.items, {
                    product_id: product.id,
                    name: product.name,
                    price_cents: Number(product.price_cents),
                    quantity: Math.min(Number(product.stock), quantity),
                    stock: Number(product.stock)
                }]
            };
        });
    }

    async function placeOrder() {
        if (busy || !cart) return;
        setBusy(true);
        setCartError('');
        try {
            if (deliveryMethod === 'delivery' && !deliveryAddress.trim()) {
                throw new Error('Enter the delivery address before placing your order.');
            }
            if (deliveryMethod === 'pickup' && (!pickupAt || new Date(pickupAt).getTime() <= Date.now())) {
                throw new Error('Choose a future pickup date and time.');
            }
            const placed = await window.pwestoPlaceOrder(cart.vendorId, cart.items.map((item) => ({
                product_id: item.product_id,
                quantity: item.quantity
            })), deliveryMethod, deliveryAddress.trim(), pickupAt, paymentMethod);
            if (placed) {
                setCart(null);
                setDeliveryMethod('pickup');
                setPaymentMethod('cash_on_pickup');
                setDeliveryAddress('');
                setPickupAt('');
                window.dispatchEvent(new Event('pwesto:products-updated'));
            }
        } catch (error) {
            setCartError(error.message || 'Your order could not be submitted. Please try again.');
        } finally {
            setBusy(false);
        }
    }

    function changeQuantity(productId, delta) {
        setCart((current) => ({
            ...current,
            items: current.items.map((item) => item.product_id === productId
                ? { ...item, quantity: Math.min(item.stock, Math.max(1, item.quantity + delta)) }
                : item)
        }));
    }

    function removeItem(productId) {
        setCart((current) => {
            const items = current.items.filter((item) => item.product_id !== productId);
            return items.length ? { ...current, items } : null;
        });
    }

    const categoryOrder = ['Meat', 'Vegetables', 'Fruits', 'Seafood', 'Pantry', 'Flowers', 'Produce'];
    const groupedVendors = vendors.reduce((groups, vendor) => {
        const category = vendor.category || 'Other';
        if (!groups[category]) groups[category] = [];
        groups[category].push(vendor);
        return groups;
    }, {});
    Object.values(groupedVendors).forEach((group) => {
        group.sort((left, right) => String(left.stall_code || '').localeCompare(String(right.stall_code || '')));
    });
    const categories = Object.keys(groupedVendors).sort((left, right) => {
        const leftIndex = categoryOrder.indexOf(left);
        const rightIndex = categoryOrder.indexOf(right);
        return (leftIndex === -1 ? categoryOrder.length : leftIndex)
            - (rightIndex === -1 ? categoryOrder.length : rightIndex) || left.localeCompare(right);
    });

    return (
        <>
            {categories.length ? categories.map((category) => (
                <section className="vendor-category-group" key={category} aria-label={category + ' stalls'}>
                    <h3 className="vendor-category-heading">
                        {category}
                        <span>{groupedVendors[category].length} {groupedVendors[category].length === 1 ? 'stall' : 'stalls'}</span>
                    </h3>
                    {groupedVendors[category].map((vendor) => (
                        <VendorCard
                            key={vendor.id}
                            vendor={vendor}
                            savedIds={savedIds}
                            canMessage={canMessage}
                            cart={cart}
                            onAddToCart={addToCart}
                        />
                    ))}
                </section>
            )) : <p className="booking-empty vendor-list-empty">No stalls match this search. Try another name or category.</p>}
            <ShoppingCart
                cart={cart}
                error={cartError}
                busy={busy}
                onQuantityChange={changeQuantity}
                onRemove={removeItem}
                onClear={() => { setCart(null); setCartError(''); setDeliveryMethod('pickup'); setPaymentMethod('cash_on_pickup'); setDeliveryAddress(''); setPickupAt(''); }}
                onPlaceOrder={placeOrder}
                deliveryMethod={deliveryMethod}
                onDeliveryMethodChange={setDeliveryMethod}
                paymentMethod={paymentMethod}
                onPaymentMethodChange={setPaymentMethod}
                deliveryAddress={deliveryAddress}
                onDeliveryAddressChange={setDeliveryAddress}
                pickupAt={pickupAt}
                onPickupAtChange={setPickupAt}
            />
        </>
    );
}

const root = createRoot(mount);

window.renderPwestoVendors = function ({ vendors, savedIds, canMessage }) {
    root.render(
        <VendorList
            vendors={vendors}
            savedIds={new Set(savedIds.map(String))}
            canMessage={canMessage}
        />
    );
};

function PwestoAssistant() {
    const [open, setOpen] = useState(false);
    const [csrfToken, setCsrfToken] = useState('');
    const [configured, setConfigured] = useState(true);
    const [messages, setMessages] = useState([{
        role: 'model',
        text: 'Hi! I can help with Pwesto, local markets, and related questions. Ano ang gusto mong malaman?'
    }]);
    const [draft, setDraft] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const transcriptRef = useRef(null);
    const assistantMount = document.getElementById('pwestoAssistant');
    const assistantApiBase = assistantMount.dataset.apiBase;

    useEffect(() => {
        let active = true;
        fetch(assistantApiBase + '/assistant', {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
        })
            .then(async (response) => {
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'The assistant could not be initialized.');
                if (active) {
                    setCsrfToken(result.csrf_token || '');
                    setConfigured(result.configured === true);
                }
            })
            .catch((requestError) => {
                if (active) setError(requestError.message || 'The assistant could not be initialized.');
            });
        return () => { active = false; };
    }, [assistantApiBase]);

    useEffect(() => {
        if (transcriptRef.current) {
            transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
        }
    }, [messages, open, loading]);

    async function sendMessage(event) {
        event.preventDefault();
        const text = draft.trim();
        if (!text || loading || !csrfToken) return;

        const history = messages
            .filter((message) => message.role === 'user' || message.role === 'model')
            .slice(-4)
            .map(({ role, text: messageText }) => ({ role, text: messageText.slice(-1000) }));
        setMessages((current) => [...current, { role: 'user', text }]);
        setDraft('');
        setError('');
        setLoading(true);
        try {
            const response = await fetch(assistantApiBase + '/assistant', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({ message: text, history })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'The assistant could not answer right now.');
            setMessages((current) => [...current, { role: 'model', text: result.answer }]);
        } catch (requestError) {
            setError(requestError.message || 'The assistant could not answer right now.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="pwesto-assistant">
            {open && (
                <section className="assistant-panel" role="dialog" aria-modal="false" aria-labelledby="assistantTitle">
                    <header className="assistant-header">
                        <div><strong id="assistantTitle">Pwesto Assistant</strong><small>Ask about Pwesto or a related topic</small></div>
                        <button className="assistant-close" type="button" aria-label="Close assistant" onClick={() => setOpen(false)}>×</button>
                    </header>
                    <div className="assistant-transcript" ref={transcriptRef} aria-live="polite" aria-relevant="additions">
                        {messages.map((message, index) => (
                            <p className={'assistant-message ' + (message.role === 'user' ? 'is-user' : 'is-model')} key={index}>
                                {message.text}
                            </p>
                        ))}
                        {loading && <p className="assistant-message is-model">Thinking…</p>}
                    </div>
                    {!configured && <p className="assistant-error">Gemini is not configured. Set GEMINI_API_KEY in the server .env file.</p>}
                    {error && <p className="assistant-error" role="alert">{error}</p>}
                    <form className="assistant-form" onSubmit={sendMessage}>
                        <textarea
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault();
                                    event.currentTarget.form.requestSubmit();
                                }
                            }}
                            maxLength="3000"
                            rows="2"
                            placeholder="Ask a question…"
                            aria-label="Ask Pwesto Assistant"
                            disabled={!configured || loading}
                        />
                        <button type="submit" disabled={!configured || !csrfToken || loading || !draft.trim()}>
                            {loading ? '…' : 'Send'}
                        </button>
                    </form>
                </section>
            )}
            <button
                className="assistant-launcher"
                type="button"
                aria-expanded={open}
                aria-label={open ? 'Close Pwesto Assistant' : 'Ask Pwesto Assistant'}
                onClick={() => setOpen((value) => !value)}
            >
                {open ? '×' : 'Ask Pwesto ✦'}
            </button>
        </div>
    );
}

const assistantMount = document.getElementById('pwestoAssistant');
if (assistantMount) {
    createRoot(assistantMount).render(<PwestoAssistant />);
}
