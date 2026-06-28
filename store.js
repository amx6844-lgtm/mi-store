// ========== نظام متجر الزبائن - Mi Store ==========

class StorageManager {
    constructor() {
        this.prefix = 'mi_store_';
    }
    get(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(this.prefix + key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    }
    set(key, value) {
        try {
            localStorage.setItem(this.prefix + key, JSON.stringify(value));
            return true;
        } catch (e) {
            return false;
        }
    }
}

class StoreApp {
    checkProductImages() {
    const products = this.storage.get('products', []);
    console.log('📦 عدد المنتجات:', products.length);
    
    products.forEach((product, index) => {
        if (product.image) {
            console.log(`✅ المنتج ${index + 1} (${product.name}) لديه صورة، الحجم: ${product.image.length} bytes`);
        } else {
            console.log(`❌ المنتج ${index + 1} (${product.name}) لا يوجد له صورة`);
        }
    });
}
   applyModalDiscount(productId) {
    const codeInput = document.getElementById('modalDiscountCode');
    const messageEl = document.getElementById('modalDiscountMessage');
    const code = codeInput.value.trim().toUpperCase();
    
    if (!code) {
        messageEl.innerHTML = '<span style="color: var(--danger);">⚠️ أدخل كود الخصم</span>';
        return;
    }
    
    const discounts = this.storage.get('discounts', []);
    const discount = discounts.find(d => d.code === code);
    
    if (!discount) {
        messageEl.innerHTML = '<span style="color: var(--danger);">❌ كود غير صالح</span>';
        return;
    }
    
    if (!discount.active) {
        messageEl.innerHTML = '<span style="color: var(--danger);">❌ هذا الكود معطل</span>';
        return;
    }
    
    if (new Date(discount.expiryDate) < new Date()) {
        messageEl.innerHTML = '<span style="color: var(--danger);">❌ الكود منتهي الصلاحية</span>';
        return;
    }
    
    if (discount.usedCount >= discount.maxUses) {
        messageEl.innerHTML = '<span style="color: var(--danger);">🚫 تم استخدام الكود بالحد الأقصى</span>';
        return;
    }
    
    // حساب الخصم
    const products = this.storage.get('products', []);
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const discountAmount = product.salePrice * (discount.discount / 100);
    const finalPrice = product.salePrice - discountAmount;
    
    messageEl.innerHTML = `
        <div style="background: #d4edda; padding: 10px; border-radius: 8px; margin-top: 8px;">
            <div style="color: #155724; font-weight: 600; margin-bottom: 5px;">
                ✅ تم تطبيق خصم ${discount.discount}%
            </div>
            <div style="color: #155724; font-size: 13px;">
                السعر الأصلي: <span style="text-decoration: line-through;">${this.formatCurrency(product.salePrice)}</span><br>
                <strong>السعر بعد الخصم: ${this.formatCurrency(finalPrice)}</strong>
            </div>
        </div>
    `;
    
    // إضافة للسلة مع السعر المخفض
    const existing = this.cart.find(item => item.id === productId);
    if (existing) {
        existing.quantity += 1;
        existing.price = finalPrice;
        existing.total = existing.quantity * existing.price;
    } else {
        this.cart.push({ 
            id: product.id, 
            name: product.name, 
            price: finalPrice, 
            originalPrice: product.salePrice,
            discountCode: discount.code,
            quantity: 1 
        });
    }
    
    this.storage.set('cart', this.cart);
    this.updateCartUI();
    this.showNotification('تم التطبيق', `تم تطبيق كود: ${discount.code}`, 'success');
    
    // تحديث زر السلة
    setTimeout(() => {
        const btn = document.querySelector('.product-detail-actions .btn-primary');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-check"></i> تمت الإضافة';
            btn.style.background = 'var(--success)';
        }
    }, 300);
}

removeDiscountCode() {
    this.appliedDiscount = null;
    const messageEl = document.getElementById('discountMessage');
    const codeInput = document.getElementById('discountCodeInput');
    if (messageEl) messageEl.innerHTML = '';
    if (codeInput) codeInput.value = '';
    this.updateCartUI();
} 
    sendChatMessage(name, phone, message) {
    const chats = this.storage.get('chats', []);
    
    // البحث عن محادثة سابقة بنفس الرقم
    let chat = chats.find(c => c.customerPhone === phone);
    
    if (chat) {
        // إضافة رسالة للمحادثة الموجودة
        chat.messages.push({
            from: 'customer',
            text: message,
            time: new Date().toISOString()
        });
        chat.lastMessage = message;
        chat.unread = (chat.unread || 0) + 1;
        chat.updatedAt = new Date().toISOString();
    } else {
        // إنشاء محادثة جديدة
        const newChat = {
            id: chats.length > 0 ? Math.max(...chats.map(c => c.id)) + 1 : 1,
            customerName: name,
            customerPhone: phone,
            unread: 1,
            lastMessage: message,
            messages: [{
                from: 'customer',
                text: message,
                time: new Date().toISOString()
            }],
            createdAt: new Date().toISOString()
        };
        chats.push(newChat);
    }
    
    this.storage.set('chats', chats);
    this.showNotification('تم الإرسال', 'تم إرسال رسالتك، سنرد عليك قريباً', 'success');
}
    loadAboutContent() {
    const about = this.storage.get('about', {});
    
    const titleEl = document.getElementById('aboutTitleDisplay');
    if (titleEl) titleEl.textContent = about.title || 'من نحن';
    
    const descEl = document.getElementById('aboutDescriptionDisplay');
    if (descEl) descEl.textContent = about.description || '';
    
    const featuresEl = document.getElementById('aboutFeaturesDisplay');
    if (featuresEl && about.features) {
        featuresEl.innerHTML = about.features.map(f => `
            <div class="feature-item">
                <i class="fas fa-check-circle"></i>
                <div>
                    <h4>${f.title}</h4>
                    <p>${f.desc}</p>
                </div>
            </div>
        `).join('');
    }
    
    const statsEl = document.getElementById('aboutStatsDisplay');
    if (statsEl && about.stats) {
        statsEl.innerHTML = `
            <div class="stat-card">
                <i class="fas fa-store"></i>
                <h3>${about.stats.years || '-'}</h3>
                <p>خبرة في المجال</p>
            </div>
            <div class="stat-card">
                <i class="fas fa-smile"></i>
                <h3>${about.stats.customers || '-'}</h3>
                <p>عميل سعيد</p>
            </div>
            <div class="stat-card">
                <i class="fas fa-box"></i>
                <h3>${about.stats.products || '-'}</h3>
                <p>منتج متنوع</p>
            </div>
        `;
    }
}

removeDiscountCode() {
    this.appliedDiscount = null;
    const messageEl = document.getElementById('discountMessage');
    const codeInput = document.getElementById('discountCodeInput');
    if (messageEl) messageEl.innerHTML = '';
    if (codeInput) codeInput.value = '';
    this.updateCartUI();
}

    constructor() {
        this.storage = new StorageManager();
        this.currentSection = 'home';
        this.currentCategory = 'all';
        this.searchQuery = '';
        this.cart = this.storage.get('cart', []);
        this.ratings = this.storage.get('ratings', {});
        this.language = 'ar';
        
        // بيانات ثابتة
        this.blogPosts = [
    { 
        id: 1, 
        title: 'كيف تحافظ على بطارية هاتفك؟', 
        excerpt: 'نصائح ذهبية لإطالة عمر بطارية هاتفك الذكي وتجنب تدهور أدائها مع مرور الوقت. تعلم أفضل الممارسات للشحن والاستخدام اليومي.',
        content: 'تعتبر بطارية الهاتف من أهم المكونات التي تؤثر على تجربتك اليومية. إليك أهم النصائح:\n\n1. لا تترك الهاتف يشحن طوال الليل\n2. احافظ على نسبة الشحن بين 20% و 80%\n3. استخدم شاحناً أصلياً معتمداً\n4. تجنب استخدام الهاتف أثناء الشحن\n5. أغلق التطبيقات التي تستهلك الطاقة في الخلفية\n\nباتباع هذه النصائح البسيطة، يمكنك إطالة عمر بطارية هاتفك بشكل ملحوظ.',
        icon: 'fa-battery-full', 
        date: '2026-06-25' 
    },
    { 
        id: 2, 
        title: 'أفضل واقيات الشاشة لعام 2026', 
        excerpt: 'مقارنة شاملة بين واقيات الشاشة الزجاجية والبلاستيكية وأيها يناسب استخدامك. دليلك الكامل لاختيار الحماية المثالية.',
        content: 'واقي الشاشة هو خط الدفاع الأول لهاتفك ضد الخدوش والكسور. الأنواع الرئيسية:\n\n🔹 الزجاج المقوى (Tempered Glass):\n- حماية عالية ضد الصدمات\n- شفافية ممتازة\n- سهولة التركيب\n- السعر: متوسط إلى عالي\n\n🔹 البلاستيك (PET/TPU):\n- رخيص الثمن\n- مرن وسهل التركيب\n- حماية متوسطة\n\n🔹 الزجاج الخاص (Privacy/Anti-Glare):\n- يحافظ على خصوصيتك\n- يقلل الانعكاسات\n- مثالي للاستخدام الخارجي\n\nننصح دائماً باختيار واقي شاشة من علامة تجارية معتمدة لضمان الجودة.',
        icon: 'fa-shield-alt', 
        date: '2026-06-20' 
    },
    { 
        id: 3, 
        title: 'دليل اختيار الشاحن المناسب', 
        excerpt: 'كيف تختار الشاحن السريع المناسب لهاتفك دون الإضرار بالبطارية. كل ما تحتاج معرفته عن تقنيات الشحن السريع.',
        content: 'اختيار الشاحن المناسب أمر بالغ الأهمية للحفاظ على بطارية هاتفك:\n\n⚡ تقنيات الشحن السريع:\n- Qualcomm Quick Charge (QC)\n- USB Power Delivery (PD)\n- VOOC / SuperVOOC\n- SuperCharge (Huawei)\n\n📋 نصائح مهمة:\n1. تأكد من توافق الشاحن مع هاتفك\n2. استخدم كابلات أصلية أو معتمدة\n3. لا تستخدم شواحن رخيصة غير معروفة\n4. افحص قوة الشحن (Watt) المناسبة\n\n🔌 القوة المناسبة:\n- الهواتف العادية: 10-18W\n- الهواتف المتوسطة: 20-33W\n- الهواتف الرائدة: 45-120W\n\nاستخدام شاحن غير مناسب قد يؤدي إلى تلف البطارية أو تقليل عمرها الافتراضي.',
        icon: 'fa-charging-station', 
        date: '2026-06-15' 
    },
    {
        id: 4,
        title: 'أفضل الكفرات لحماية هاتفك',
        excerpt: 'دليل شامل لاختيار الكفر المناسب لهاتفك. تعرف على أنواع الكفرات ومميزات كل نوع وأيها يناسب أسلوب حياتك.',
        content: 'الكفر هو استثمار بسيط يحمي هاتفك من أضرار قد تكلفك الكثير:\n\n🛡️ أنواع الكفرات:\n\n1. الكفرات السيليكونية:\n- خفيفة ومرنة\n- حماية جيدة من الخدوش\n- أسعار مناسبة\n\n2. الكفرات الجلدية:\n- مظهر أنيق وفاخر\n- حماية متوسطة\n- مناسبة للمناسبات الرسمية\n\n3. الكفرات المقاومة للصدمات (Rugged):\n- حماية عالية جداً\n- مناسبة للأنشطة الخارجية\n- قد تكون سميكة بعض الشيء\n\n4. الكفرات الشفافة:\n- تظهر تصميم الهاتف الأصلي\n- حماية جيدة\n- سهلة التنظيف\n\n💡 نصيحة: اختر كفرة بحواف مرتفعة لحماية الشاشة والكاميرا.',
        icon: 'fa-mobile-alt',
        date: '2026-06-10'
    },
    {
        id: 5,
        title: 'كيف تنظف هاتفك بشكل صحيح؟',
        excerpt: 'طرق آمنة وفعالة لتنظيف هاتفك وتعقيمه دون الإضرار بالشاشة أو المكونات الداخلية.',
        content: 'الهاتف من أكثر الأجهزة التي نلمسها يومياً، لذا تنظيفه أمر ضروري:\n\n🧼 أدوات التنظيف الآمنة:\n- قماش مايكروفايبر ناعم\n- محلول تنظيف مخصص للشاشات\n- معقم يحتوي على 70% كحول\n\n❌ تجنب تماماً:\n- المنظفات المنزلية القوية\n- المناديل الورقية الخشنة\n- رش السوائل مباشرة على الهاتف\n- الغمر في الماء\n\n📱 خطوات التنظيف:\n1. أغلق الهاتف وافصل الكابلات\n2. امسح الشاشة بقطعة مايكروفايبر جافة\n3. بلل القطنة قليلاً بالمعقم وامسح برفق\n4. جفف بقطعة نظيفة\n5. نظف المنافذ بفرشاة ناعمة جافة\n\n⏰ كرر العملية أسبوعياً للحفاظ على نظافة هاتفك.',
        icon: 'fa-spray-can',
        date: '2026-06-05'
    }
];

        this.testimonials = [
            { name: 'أحمد محمد', text: 'منتجات أصلية 100% والتوصيل كان سريع جداً. أنصح بالتعامل معهم.', rating: 5 },
            { name: 'سارة علي', text: 'أسعار ممتازة مقارنة بالسوق، والكفرات جودة عالية.', rating: 5 },
            { name: 'حسين كاظم', text: 'خدمة عملاء راقية وساعدوني في اختيار واقي الشاشة المناسب.', rating: 4 }
        ];

        this.init();
    }

    init() {
        this.loadSettings();
        this.setupEventListeners();
        this.renderAllSections();
        this.updateCartUI();
        this.startCountdown();
        this.setupWhatsApp();
        this.showNotification();
        this.loadAboutContent();
        // فحص الصور عند تحميل الصفحة
        this.checkProductImages();
        // فحص الصور عند التحميل
setTimeout(() => {
    const products = this.storage.get('products', []);
    const productsWithImages = products.filter(p => p.image).length;
    console.log(`📊 منتجات مع صور: ${productsWithImages}/${products.length}`);
}, 1000);
        // تحديث رقم واتساب في زر التواصل
const settings = this.storage.get('settings', {});
const phone = settings.storePhone || '07738414085';
const cleanPhone = phone.replace(/\D/g, '');
const whatsappContactBtn = document.getElementById('whatsappContactBtn');
if (whatsappContactBtn) {
    whatsappContactBtn.href = `https://wa.me/${cleanPhone}`;
}
    }

    // ===== الإعدادات والاتصال =====
    loadSettings() {
    const settings = this.storage.get('settings', {});
    
    // تحديث العناصر إذا كانت موجودة
    const addressEl = document.getElementById('storeAddress');
    if (addressEl) addressEl.textContent = settings.storeAddress || 'بغداد - العراق';
    
    const phoneEl = document.getElementById('storePhone');
    if (phoneEl) phoneEl.textContent = settings.storePhone || '07700000000';
    
    const footerPhoneEl = document.getElementById('footerPhone');
    if (footerPhoneEl) footerPhoneEl.textContent = settings.storePhone || '07700000000';
    
    const totalProductsEl = document.getElementById('totalProducts');
    if (totalProductsEl) totalProductsEl.textContent = this.storage.get('products', []).length;
}

    setupWhatsApp() {
        const settings = this.storage.get('settings', {});
        const phone = settings.storePhone || '07700000000';
        const cleanPhone = phone.replace(/\D/g, '');
        document.getElementById('whatsappBtn').href = `https://wa.me/${cleanPhone}`;
    }

    // ===== مستمعات الأحداث =====
    setupEventListeners() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.showSection(link.dataset.section);
            });
    // إضافة مستمع لنموذج الشات في الفوتر
const chatForm = document.getElementById('footerChatForm');
if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('chatName').value.trim();
        const phone = document.getElementById('chatPhone').value.trim();
        const message = document.getElementById('chatMessage').value.trim();
        if (name && phone && message) {
            this.sendChatMessage(name, phone, message);
            chatForm.reset();
        }
    });
}
        });

        document.getElementById('heroSearch').addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            if (this.searchQuery.length > 1) {
                this.showSection('accessories');
                document.getElementById('accessoriesSearch').value = this.searchQuery;
                this.renderAccessories();
            }
        });

        document.getElementById('accessoriesSearch').addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.renderAccessories();
        });

        document.querySelectorAll('.sub-cat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sub-cat-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentCategory = btn.dataset.cat;
                document.getElementById('categoryFilter').value = this.currentCategory;
                this.renderAccessories();
            });
        });

        document.getElementById('contactForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.showNotification('تم الإرسال', 'تم إرسال رسالتك بنجاح! سنتواصل معك قريباً.', 'success');
            e.target.reset();
        });

        document.getElementById('productModal').addEventListener('click', (e) => {
            if (e.target.id === 'productModal') this.closeModal();
        });

        document.getElementById('mobileMenuBtn').addEventListener('click', () => {
            document.querySelector('.main-nav').classList.toggle('open');
        });
    }

    // ===== التنقل =====
    showSection(section, category = null) {
        this.currentSection = section;
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(section + 'Section');
        if (target) target.classList.add('active');

        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.section === section);
        });

        if (category) {
            this.currentCategory = category;
            document.querySelectorAll('.sub-cat-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.cat === category);
            });
            if (document.getElementById('categoryFilter')) document.getElementById('categoryFilter').value = category;
            this.renderAccessories();
        }

        document.querySelector('.main-nav').classList.remove('open');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ===== عرض الأقسام =====
    renderAllSections() {
        this.renderFeaturedProducts();
        this.renderNewArrivals();
        this.renderBestsellers();
        this.renderAccessories();
        this.renderOffers();
        this.renderBlog();
        this.renderTestimonials();
    }

    getProducts() { return this.storage.get('products', []); }

    renderFeaturedProducts() {
        const products = this.getProducts().slice(0, 8);
        this.renderGrid('featuredProducts', products);
    }

    renderNewArrivals() {
        const products = this.getProducts().slice(-6).reverse();
        this.renderGrid('newArrivals', products, 'new');
    }

    renderBestsellers() {
        const sales = this.storage.get('sales', []);
        const productSales = {};
        sales.forEach(sale => {
            if (sale.status !== 'cancelled') {
                sale.items.forEach(item => {
                    productSales[item.productId] = (productSales[item.productId] || 0) + item.quantity;
                });
            }
        });
        
        const products = this.getProducts().map(p => ({
            ...p,
            salesCount: productSales[p.id] || 0
        })).sort((a, b) => b.salesCount - a.salesCount).slice(0, 8);

        this.renderGrid('bestsellersProducts', products, 'hot');
    }

    renderOffers() {
    const offers = this.storage.get('offers', { products: [] });
    const products = this.storage.get('products', []);
    const container = document.getElementById('offersProducts');
    
    if (!container) return;
    
    // تحديث عنوان العرض
    const offersTitle = document.querySelector('#offersSection .section-subtitle');
    if (offersTitle && offers.title) {
        offersTitle.textContent = offers.title;
    }
    
    // التحقق من انتهاء العرض
    const now = new Date();
    const isExpired = offers.endTime && new Date(offers.endTime) < now;
    
    if (isExpired || !offers.products || offers.products.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-fire"></i><p>لا توجد عروض حالياً</p></div>';
        return;
    }
    
    // عرض المنتجات في العروض
    const offerProducts = offers.products.map(op => {
        const product = products.find(p => p.id === op.productId);
        if (product) {
            return { ...product, offerDiscount: op.discount };
        }
        return null;
    }).filter(p => p !== null);
    
    if (offerProducts.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-fire"></i><p>لا توجد عروض حالياً</p></div>';
        return;
    }
    
    container.innerHTML = offerProducts.map(p => {
        const discountedPrice = p.salePrice * (1 - p.offerDiscount / 100);
        const categoryNames = { phones: 'هواتف', accessories: 'إكسسوارات', chargers: 'شواحن', cases: 'كفرات' };
        const icons = { phones: 'fa-mobile-alt', accessories: 'fa-headphones', chargers: 'fa-charging-station', cases: 'fa-mobile' };
        
        return `
            <div class="product-card" onclick="app.showProductDetails(${p.id})">
                <div class="product-image">
                    <i class="fas ${icons[p.category] || 'fa-box'}"></i>
                    <span class="product-badge">-${p.offerDiscount}%</span>
                </div>
                <div class="product-info">
                    <div class="product-category">${categoryNames[p.category] || p.category}</div>
                    <h3 class="product-name">${p.name}</h3>
                    <div class="product-price">
                        <span class="price-current">${this.formatCurrency(discountedPrice)}</span>
                        <span class="price-old">${this.formatCurrency(p.salePrice)}</span>
                    </div>
                    <button class="product-btn" onclick="event.stopPropagation(); app.addToCart(${p.id})">
                        <i class="fas fa-cart-plus"></i>
                        أضف للسلة
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

    renderAccessories() {
        let products = this.getProducts();
        const category = document.getElementById('categoryFilter')?.value || this.currentCategory || 'all';
        const priceRange = document.getElementById('priceFilter')?.value || 'all';
        const sortBy = document.getElementById('sortFilter')?.value || 'newest';

        if (category !== 'all') products = products.filter(p => p.category === category);
        
        if (priceRange !== 'all') {
            if (priceRange === '100000+') {
                products = products.filter(p => p.salePrice >= 100000);
            } else {
                const [min, max] = priceRange.split('-').map(Number);
                products = products.filter(p => p.salePrice >= min && p.salePrice <= max);
            }
        }

        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            products = products.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
        }

        if (sortBy === 'price-asc') products.sort((a, b) => a.salePrice - b.salePrice);
        else if (sortBy === 'price-desc') products.sort((a, b) => b.salePrice - a.salePrice);
        else if (sortBy === 'rating') products.sort((a, b) => this.getProductRating(b.id) - this.getProductRating(a.id));
        else products.sort((a, b) => b.id - a.id);

        this.renderGrid('accessoriesProducts', products);
    }

    applyFilters() {
        this.currentCategory = document.getElementById('categoryFilter').value;
        document.querySelectorAll('.sub-cat-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.cat === this.currentCategory);
        });
        this.renderAccessories();
    }

    renderGrid(containerId, products, badgeType = null) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (products.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><p>لا توجد منتجات حالياً</p></div>';
            return;
        }

        container.innerHTML = products.map(p => this.createProductCard(p, badgeType)).join('');
    }

    createProductCard(product, badgeType = null) {
    const categoryNames = { phones: 'هواتف', accessories: 'إكسسوارات', chargers: 'شواحن', cases: 'كفرات', screen: 'واقيات شاشة' };
    const icons = { phones: 'fa-mobile-alt', accessories: 'fa-headphones', chargers: 'fa-charging-station', cases: 'fa-mobile', screen: 'fa-shield-alt' };
    const rating = this.getProductRating(product.id);
    const inCart = this.cart.find(item => item.id === product.id);

    let badge = '';
    if (badgeType === 'new') badge = '<span class="product-badge new">جديد</span>';
    else if (badgeType === 'hot') badge = '<span class="product-badge hot">🔥 الأكثر مبيعاً</span>';
    else if (badgeType === 'discount') {
        const discount = Math.floor(Math.random() * 20) + 10;
        badge = `<span class="product-badge">-${discount}%</span>`;
    }

    // التحقق من وجود الصورة بشكل صحيح
    let productImageHTML = '';
    if (product.image && typeof product.image === 'string' && product.image.startsWith('data:image')) {
        productImageHTML = `
            <img src="${product.image}" 
                 alt="${product.name}" 
                 style="width: 100%; height: 100%; object-fit: cover;"
                 onerror="console.error('❌ فشل تحميل الصورة:', this.src); this.parentElement.innerHTML='<i class=\\'fas ${icons[product.category] || 'fa-box'}\\' style=\\'font-size:60px;color:#ccc\\'></i>';">
        `;
    } else {
        productImageHTML = `<i class="fas ${icons[product.category] || 'fa-box'}" style="font-size: 60px; color: #ccc;"></i>`;
    }

    return `
        <div class="product-card" onclick="app.showProductDetails(${product.id})">
            <div class="product-image" style="position: relative; overflow: hidden;">
                ${productImageHTML}
                ${badge}
                <div class="product-rating"><i class="fas fa-star" style="color:#FFD700"></i> ${rating.toFixed(1)}</div>
            </div>
            <div class="product-info">
                <div class="product-category">${categoryNames[product.category] || product.category}</div>
                <h3 class="product-name">${product.name}</h3>
                <div class="product-price">
                    <span class="price-current">${this.formatCurrency(product.salePrice)}</span>
                </div>
                <button class="product-btn ${inCart ? 'added' : ''}" onclick="event.stopPropagation(); app.addToCart(${product.id})">
                    <i class="fas ${inCart ? 'fa-check' : 'fa-cart-plus'}"></i>
                    ${inCart ? 'في السلة' : 'أضف للسلة'}
                </button>
            </div>
        </div>
    `;
}

    // ===== تفاصيل المنتج والتقييم =====
        showProductDetails(productId) {
        const products = this.storage.get('products', []);
        const product = products.find(p => p.id === productId);
        if (!product) return;

        const categoryNames = { phones: 'هواتف', accessories: 'إكسسوارات', chargers: 'شواحن', cases: 'كفرات', screen: 'واقيات شاشة' };
        const icons = { phones: 'fa-mobile-alt', accessories: 'fa-headphones', chargers: 'fa-charging-station', cases: 'fa-mobile', screen: 'fa-shield-alt' };
        const rating = this.getProductRating(product.id);
        const userRating = this.ratings[productId]?.userRating || 0;

        const related = products.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);
        const settings = this.storage.get('settings', {});
        const phone = settings.storePhone || '07700000000';
        const message = `مرحباً، أريد الاستفسار عن: ${product.name} - ${this.formatCurrency(product.salePrice)}`;
        const whatsappLink = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

        const content = `
            <div class="product-detail-header">
                <div class="product-detail-image">
    ${product.image && product.image.startsWith('data:image') 
        ? `<img src="${product.image}" alt="${product.name}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\\'fas ${icons[product.category] || 'fa-box'}\\' style=\\'font-size:100px\\'></i>';">`
        : `<i class="fas ${icons[product.category] || 'fa-box'}" style="font-size: 100px;"></i>`
    }
</div>
                <div class="product-detail-info">
                    <div class="product-category">${categoryNames[product.category] || product.category}</div>
                    <h2>${product.name}</h2>
                    <div class="product-rating" style="position:static;display:inline-flex;margin-bottom:10px;background:none;color:#333">
                        <i class="fas fa-star" style="color:#FFD700"></i> ${rating.toFixed(1)} (${this.ratings[productId]?.count || 0} تقييم)
                    </div>
                    <div class="product-detail-price">${this.formatCurrency(product.salePrice)}</div>
                    <p class="product-detail-desc">${product.description || 'منتج عالي الجودة من Mi Store. ضمان أصالة المنتج وإمكانية الاسترجاع خلال 7 أيام.'}</p>
                    
                    <!-- كود الخصم -->
                    <div class="discount-section" style="background: var(--bg-light); padding: 15px; border-radius: var(--radius); margin: 20px 0; border: 2px dashed var(--primary);">
                        <label style="font-size: 14px; font-weight: 600; display: block; margin-bottom: 10px;">
                            <i class="fas fa-ticket-alt" style="color: var(--primary);"></i>
                            لديك كود خصم؟
                        </label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="modalDiscountCode" class="form-input" placeholder="أدخل الكود هنا" style="flex: 1; text-transform: uppercase;">
                            <button type="button" class="btn btn-primary" onclick="app.applyModalDiscount(${product.id})" style="padding: 10px 20px;">
                                تطبيق
                            </button>
                        </div>
                        <div id="modalDiscountMessage" style="margin-top: 8px; font-size: 12px;"></div>
                    </div>
                    
                    <div class="product-detail-actions">
                        <button class="btn btn-primary" onclick="app.addToCart(${product.id}); app.closeModal()">
                            <i class="fas fa-cart-plus"></i> أضف للسلة
                        </button>
                        <a href="${whatsappLink}" target="_blank" class="btn btn-outline" style="text-decoration:none;color:var(--text-dark);border-color:var(--border-color)">
                            <i class="fab fa-whatsapp" style="color:#25D366"></i> اطلب عبر واتساب
                        </a>
                    </div>
                </div>
            </div>

            <div class="rating-section">
                <h4><i class="fas fa-star" style="color:#FFD700"></i> قيّم هذا المنتج</h4>
                <div class="rating-stars" id="ratingStars">
                    ${[1,2,3,4,5].map(i => `<i class="fas fa-star ${i <= userRating ? 'active' : ''}" onclick="app.setRating(${product.id}, ${i})"></i>`).join('')}
                </div>
                <textarea class="rating-input" id="ratingComment" placeholder="اكتب تعليقك (اختياري)...">${this.ratings[productId]?.comment || ''}</textarea>
                <button class="btn btn-primary" onclick="app.saveRating(${product.id})">إرسال التقييم</button>
            </div>

            ${related.length > 0 ? `
                <div class="related-products">
                    <h4>منتجات مشابهة</h4>
                    <div class="related-grid">
                        ${related.map(r => `
                            <div class="related-item" onclick="app.showProductDetails(${r.id})">
                                <i class="fas ${icons[r.category] || 'fa-box'}"></i>
                                <div class="name">${r.name}</div>
                                <div class="price">${this.formatCurrency(r.salePrice)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;

        document.getElementById('modalContent').innerHTML = content;
        document.getElementById('productModal').classList.add('active');
    }

    closeModal() {
        document.getElementById('productModal').classList.remove('active');
    }

    getProductRating(productId) {
        const r = this.ratings[productId];
        return r ? (r.total / r.count) : 4.5; // افتراضي 4.5
    }

    setRating(productId, stars) {
        this.ratings[productId] = this.ratings[productId] || { total: 0, count: 0, comment: '' };
        this.ratings[productId].userRating = stars;
        const starsContainer = document.getElementById('ratingStars');
        starsContainer.querySelectorAll('i').forEach((star, idx) => {
            star.classList.toggle('active', idx < stars);
        });
    }

    saveRating(productId) {
        const userRating = this.ratings[productId]?.userRating || 0;
        const comment = document.getElementById('ratingComment').value;
        
        if (userRating === 0) {
            this.showNotification('تنبيه', 'يرجى اختيار عدد النجوم', 'warning');
            return;
        }

        if (!this.ratings[productId].count) {
            this.ratings[productId].total = 0;
            this.ratings[productId].count = 0;
        }
        
        this.ratings[productId].total += userRating;
        this.ratings[productId].count += 1;
        this.ratings[productId].comment = comment;
        this.storage.set('ratings', this.ratings);
        
        this.showNotification('شكراً لك!', 'تم حفظ تقييمك بنجاح', 'success');
        this.closeModal();
        this.renderAllSections();
    }

    // ===== سلة المشتريات =====
    addToCart(productId) {
        const product = this.getProducts().find(p => p.id === productId);
        if (!product) return;

        const existing = this.cart.find(item => item.id === productId);
        if (existing) {
            existing.quantity += 1;
        } else {
            this.cart.push({ id: product.id, name: product.name, price: product.salePrice, quantity: 1 });
        }
        
        this.storage.set('cart', this.cart);
        this.updateCartUI();
        this.showNotification('تمت الإضافة', `تمت إضافة "${product.name}" إلى السلة`, 'success');
        
        // تحديث الأزرار في الصفحة الحالية
        this.renderAllSections();
    }

    removeFromCart(productId) {
        this.cart = this.cart.filter(item => item.id !== productId);
        this.storage.set('cart', this.cart);
        this.updateCartUI();
        this.renderAllSections();
    }

    updateCartQty(productId, delta) {
        const item = this.cart.find(i => i.id === productId);
        if (!item) return;
        
        item.quantity += delta;
        if (item.quantity <= 0) {
            this.removeFromCart(productId);
        } else {
            this.storage.set('cart', this.cart);
            this.updateCartUI();
        }
    }

    updateCartUI() {
    const count = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // تطبيق الخصم إذا موجود
    let discountAmount = 0;
    if (this.appliedDiscount) {
        discountAmount = this.appliedDiscount.amount;
    }
    
    const total = Math.max(0, subtotal - discountAmount);
    
    document.getElementById('cartCount').textContent = count;
    document.getElementById('cartTotal').textContent = this.formatCurrency(total);

    const cartItems = document.getElementById('cartItems');
    if (this.cart.length === 0) {
        cartItems.innerHTML = '<div class="empty-state" style="padding:30px"><i class="fas fa-shopping-basket"></i><p>السلة فارغة</p></div>';
        // إخفاء صف الخصم
        const discountRow = document.getElementById('cartDiscountRow');
        if (discountRow) discountRow.style.display = 'none';
    } else {
        cartItems.innerHTML = this.cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-icon"><i class="fas fa-box"></i></div>
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">${this.formatCurrency(item.price)}</div>
                </div>
                <div class="cart-item-qty">
                    <button class="qty-btn" onclick="app.updateCartQty(${item.id}, -1)"><i class="fas fa-minus"></i></button>
                    <span class="qty-value">${item.quantity}</span>
                    <button class="qty-btn" onclick="app.updateCartQty(${item.id}, 1)"><i class="fas fa-plus"></i></button>
                </div>
                <button class="cart-item-remove" onclick="app.removeFromCart(${item.id})"><i class="fas fa-trash"></i></button>
            </div>
        `).join('');
        
        // إظهار صف الخصم إذا موجود
        const discountRow = document.getElementById('cartDiscountRow');
        const discountAmountEl = document.getElementById('cartDiscountAmount');
        if (discountRow && discountAmountEl) {
            if (discountAmount > 0) {
                discountRow.style.display = 'block';
                discountAmountEl.textContent = '-' + this.formatCurrency(discountAmount);
            } else {
                discountRow.style.display = 'none';
            }
        }
    }
}

    toggleCart() {
        document.getElementById('cartSidebar').classList.toggle('open');
        document.getElementById('cartOverlay').classList.toggle('show');
    }

    clearCart() {
        if (this.cart.length === 0) return;
        this.cart = [];
        this.storage.set('cart', this.cart);
        this.updateCartUI();
        this.renderAllSections();
        this.showNotification('تم', 'تم تفريغ السلة', 'info');
    }

    checkoutWhatsApp() {
    if (this.cart.length === 0) {
        this.showNotification('تنبيه', 'السلة فارغة!', 'warning');
        return;
    }

    const settings = this.storage.get('settings', {});
    const phone = settings.storePhone || '07700000000';
    const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    let discountAmount = 0;
    let discountCode = '';
    if (this.appliedDiscount) {
        discountAmount = this.appliedDiscount.amount;
        discountCode = this.appliedDiscount.code;
    }
    
    const total = Math.max(0, subtotal - discountAmount);

    let message = ` *طلب جديد من Mi Store*\n\n`;
    this.cart.forEach((item, idx) => {
        message += `${idx + 1}. ${item.name}\n   الكمية: ${item.quantity} | السعر: ${this.formatCurrency(item.price * item.quantity)}\n\n`;
    });
    
    if (discountCode) {
        message += ` *كود الخصم:* ${discountCode}\n`;
        message += `💸 *الخصم:* -${this.formatCurrency(discountAmount)}\n`;
    }
    
    message += `\n💰 *الإجمالي: ${this.formatCurrency(total)}*\n\nيرجى تأكيد الطلب وتفاصيل التوصيل.`;

    const url = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    
    this.showNotification('تم التحويل', 'تم فتح واتساب لإتمام الطلب', 'success');
}

    // ===== المدونة ومن نحن =====
    renderBlog() {
    const container = document.getElementById('blogPosts');
    if (!container) return;
    container.innerHTML = this.blogPosts.map(post => `
        <div class="blog-card">
            <div class="blog-image"><i class="fas ${post.icon}"></i></div>
            <div class="blog-content">
                <div class="blog-meta">
                    <span><i class="fas fa-calendar"></i> ${post.date}</span>
                    <span><i class="fas fa-user"></i> Mi Store</span>
                </div>
                <h3>${post.title}</h3>
                <p>${post.excerpt}</p>
                <button class="read-more" onclick="app.showBlogPost(${post.id})" style="background:none;border:none;cursor:pointer;font-family:inherit">
                    اقرأ المزيد <i class="fas fa-arrow-left"></i>
                </button>
            </div>
        </div>
    `).join('');
}

showBlogPost(id) {
    const post = this.blogPosts.find(p => p.id === id);
    if (!post) return;
    
    const content = `
        <div style="text-align:center;margin-bottom:20px">
            <div style="width:100px;height:100px;background:linear-gradient(135deg,var(--primary),var(--primary-dark));border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto;color:white;font-size:40px">
                <i class="fas ${post.icon}"></i>
            </div>
        </div>
        <h2 style="margin-bottom:10px">${post.title}</h2>
        <div style="color:var(--text-muted);margin-bottom:20px;font-size:14px">
            <i class="fas fa-calendar"></i> ${post.date} | 
            <i class="fas fa-user"></i> Mi Store
        </div>
        <div style="line-height:1.8;color:var(--text-dark);white-space:pre-wrap">${post.content}</div>
    `;
    
    document.getElementById('modalContent').innerHTML = content;
    document.getElementById('productModal').classList.add('active');
}

    renderTestimonials() {
        const container = document.getElementById('testimonialsList');
        if (!container) return;
        container.innerHTML = this.testimonials.map(t => `
            <div class="testimonial-card">
                <div class="testimonial-rating">
                    ${'<i class="fas fa-star"></i>'.repeat(t.rating)}${'<i class="far fa-star"></i>'.repeat(5 - t.rating)}
                </div>
                <p class="testimonial-text">${t.text}</p>
                <div class="testimonial-author">
                    <div class="testimonial-avatar">${t.name.charAt(0)}</div>
                    <div class="testimonial-author-info">
                        <strong>${t.name}</strong>
                        <span>عميل مميز</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // ===== العد التنازلي =====
    startCountdown() {
        const endTime = new Date();
        endTime.setHours(23, 59, 59, 999);

        const update = () => {
            const now = new Date();
            let diff = endTime - now;
            if (diff < 0) diff = 0;

            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);

            const el = document.getElementById('countdown');
            if (el) {
                el.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            }
        };

        update();
        setInterval(update, 1000);
    }

    // ===== الإشعارات =====
    showNotification(title, message, type = 'success') {
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();

        const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
        const colors = { success: 'var(--success)', error: 'var(--danger)', warning: 'var(--warning)', info: 'var(--info)' };

        const notif = document.createElement('div');
        notif.className = `notification ${type}`;
        notif.innerHTML = `
            <i class="fas ${icons[type]}" style="color:${colors[type]};font-size:22px"></i>
            <div>
                <strong style="display:block;font-size:14px;margin-bottom:3px">${title}</strong>
                <span style="font-size:13px;color:var(--text-muted)">${message}</span>
            </div>
        `;
        document.body.appendChild(notif);

        setTimeout(() => {
            notif.style.opacity = '0';
            notif.style.transform = 'translateX(100%)';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }

    // ===== الشات المباشر =====
    toggleChat() {
        const widget = document.getElementById('chatWidget');
        const btn = document.querySelector('.chat-toggle-btn');
        widget.classList.toggle('open');
        btn.classList.toggle('hidden');
    }

    sendMessage() {
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        if (!text) return;

        const chatBody = document.getElementById('chatBody');
        
        // رسالة المستخدم
        const userMsg = document.createElement('div');
        userMsg.className = 'chat-message user';
        userMsg.innerHTML = `<p>${text}</p>`;
        chatBody.appendChild(userMsg);
        
        input.value = '';
        chatBody.scrollTop = chatBody.scrollHeight;

        // رد تلقائي بعد ثانية
        setTimeout(() => {
            const botMsg = document.createElement('div');
            botMsg.className = 'chat-message bot';
            
            const responses = [
                'شكراً لتواصلك! سيتم الرد عليك من قبل خدمة العملاء قريباً.',
                'يمكنك أيضاً التواصل معنا مباشرة عبر واتساب.',
                'هل تبحث عن منتج معين؟ يمكننا مساعدتك في العثور عليه.',
                'ساعات عملنا: السبت - الخميس من 9 صباحاً حتى 9 مساءً.'
            ];
            
            botMsg.innerHTML = `<p>${responses[Math.floor(Math.random() * responses.length)]}</p>`;
            chatBody.appendChild(botMsg);
            chatBody.scrollTop = chatBody.scrollHeight;
        }, 1000);
    }

    // ===== تعدد اللغات =====
    toggleLanguage() {
        this.language = this.language === 'ar' ? 'en' : 'ar';
        const html = document.documentElement;
        html.dir = this.language === 'ar' ? 'rtl' : 'ltr';
        html.lang = this.language;
        
        const btn = document.querySelector('.lang-btn span');
        if (btn) btn.textContent = this.language === 'ar' ? 'EN' : 'ع';

        this.showNotification('تم', `تم تغيير اللغة إلى ${this.language === 'ar' ? 'العربية' : 'English'}`, 'info');
    }

    // ===== أدوات مساعدة =====
    formatCurrency(amount) {
        return new Intl.NumberFormat('ar-IQ').format(amount || 0) + ' د.ع';
    }
}

// ========== بدء التشغيل ==========
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new StoreApp();
});