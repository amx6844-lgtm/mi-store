// ========== نظام إدارة Mi Store - الملف الكامل المحدث ==========
class StorageManager {
    constructor() {
        this.prefix = 'mi_store_';
        this.useFirebase = typeof db !== 'undefined';
        console.log('📊 نظام التخزين:', this.useFirebase ? 'Firebase ✅' : 'LocalStorage فقط');
    }
    
    async get(key, defaultValue = null) {
        if (this.useFirebase) {
            try {
                const doc = await db.collection('mistore').doc(key).get();
                if (doc.exists) {
                    console.log('📥 تم جلب', key, 'من Firebase');
                    return doc.data().value;
                }
                return defaultValue;
            } catch (error) {
                console.error('❌ خطأ في جلب البيانات:', error);
                return this.getLocal(key, defaultValue);
            }
        } else {
            return this.getLocal(key, defaultValue);
        }
    }
    
    async set(key, value) {
        if (this.useFirebase) {
            try {
                await db.collection('mistore').doc(key).set({
                    value: value,
                    updatedAt: new Date().toISOString()
                });
                console.log('📤 تم حفظ', key, 'في Firebase');
                return true;
            } catch (error) {
                console.error('❌ خطأ في حفظ البيانات:', error);
                return this.setLocal(key, value);
            }
        } else {
            return this.setLocal(key, value);
        }
    }
    
    async remove(key) {
        if (this.useFirebase) {
            try {
                await db.collection('mistore').doc(key).delete();
            } catch (error) {
                console.error('❌ خطأ في الحذف:', error);
            }
        }
        localStorage.removeItem(this.prefix + key);
    }
    
    getLocal(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(this.prefix + key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    }
    
    setLocal(key, value) {
        try {
            localStorage.setItem(this.prefix + key, JSON.stringify(value));
            return true;
        } catch (e) {
            return false;
        }
    }
}

class ToastManager {
    constructor() {
        this.container = document.getElementById('toastContainer');
    }
    show(title, message, type = 'info', duration = 3500) {
        const icons = { success: 'fa-check', error: 'fa-times', warning: 'fa-exclamation', info: 'fa-info' };
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon"><i class="fas ${icons[type]}"></i></div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
        `;
        this.container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    success(t, m) { this.show(t, m, 'success'); }
    error(t, m) { this.show(t, m, 'error'); }
    warning(t, m) { this.show(t, m, 'warning'); }
    info(t, m) { this.show(t, m, 'info'); }
}

class ModalManager {
    constructor() {
        this.overlay = document.getElementById('modalOverlay');
        this.modal = document.getElementById('modal');
        this.title = document.getElementById('modalTitle');
        this.body = document.getElementById('modalBody');
        this.footer = document.getElementById('modalFooter');
        this.closeBtn = document.getElementById('modalClose');
        this.closeBtn.addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay.classList.contains('active')) this.close();
        });
    }
    open(title, bodyHTML, footerHTML = '') {
        this.title.textContent = title;
        this.body.innerHTML = bodyHTML;
        this.footer.innerHTML = footerHTML;
        this.overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    close() {
        this.overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    confirm(title, message, onConfirm) {
        this.open(title, `<p style="font-size:15px;color:var(--text-secondary)">${message}</p>`, `
            <button class="btn btn-outline" onclick="app.modal.close()">إلغاء</button>
            <button class="btn btn-danger" id="confirmBtn">تأكيد</button>
        `);
        document.getElementById('confirmBtn').addEventListener('click', () => { onConfirm(); this.close(); });
    }
}

class AuthManager {
    constructor() {
        this.credentials = { username: 'admin', password: 'admin123', fullName: 'مدير النظام', role: 'admin' };
    }
    login(username, password) {
        if (username === this.credentials.username && password === this.credentials.password) {
            const user = { username, fullName: this.credentials.fullName, role: this.credentials.role, loginTime: new Date().toISOString() };
            sessionStorage.setItem('mi_store_session', JSON.stringify(user));
            return { success: true, user };
        }
        return { success: false, message: 'بيانات الدخول غير صحيحة' };
    }
    logout() { sessionStorage.removeItem('mi_store_session'); window.location.reload(); }
    getCurrentUser() {
        try { return JSON.parse(sessionStorage.getItem('mi_store_session')); } catch { return null; }
    }
    isAuthenticated() { return !!this.getCurrentUser(); }
}

// ========== الكلاس الرئيسي ==========
class MiStoreApp {
    constructor() {
        this.storage = new StorageManager();
        this.toast = new ToastManager();
        this.modal = new ModalManager();
        this.auth = new AuthManager();
        this.currentPage = 'dashboard';
        this.cart = [];
        this.currentChatId = null;
        this.selectedProductImage = null;
        
        this.init();
    }
    
    async init() {
        await this.initData();
        this.initEventListeners();
        this.checkAuth();
    }
    
    // ===== تهيئة البيانات =====
    async initData() {
        console.log('🔄 بدء تهيئة البيانات...');
        
        if (typeof db !== 'undefined') {
            try {
                const existingData = await db.collection('mistore').doc('initialized').get();
                if (existingData.exists && existingData.data().value === true) {
                    console.log('✅ البيانات موجودة مسبقاً في Firebase');
                    return;
                }
            } catch (error) {
                console.log('⚠️ لا توجد بيانات في Firebase، سيتم التهيئة');
            }
        }
        
        const isInitialized = await this.storage.get('initialized');
        if (isInitialized) {
            console.log('✅ البيانات مهيأة بالفعل');
            return;
        }
        
        console.log('📦 إنشاء البيانات الافتراضية...');
        
        await this.storage.set('products', [
            { id: 1, code: 'PH-001', name: 'Xiaomi Redmi Note 13', category: 'phones', purchasePrice: 180000, salePrice: 220000, quantity: 15, minQuantity: 5, description: 'هاتف شاومي ريدمي نوت 13', image: null, createdAt: new Date().toISOString() },
            { id: 2, code: 'PH-002', name: 'Xiaomi 14 Pro', category: 'phones', purchasePrice: 650000, salePrice: 780000, quantity: 8, minQuantity: 3, description: 'هاتف شاومي 14 برو', image: null, createdAt: new Date().toISOString() },
            { id: 3, code: 'AC-001', name: 'شاحن سريع 67W', category: 'chargers', purchasePrice: 15000, salePrice: 25000, quantity: 50, minQuantity: 10, description: 'شاحن سريع أصلي', image: null, createdAt: new Date().toISOString() },
            { id: 4, code: 'AC-002', name: 'كفر سيليكون شفاف', category: 'cases', purchasePrice: 3000, salePrice: 7000, quantity: 100, minQuantity: 20, description: 'كفر سيليكون', image: null, createdAt: new Date().toISOString() },
            { id: 5, code: 'AC-003', name: 'سماعات بلوتوث Redmi Buds', category: 'accessories', purchasePrice: 25000, salePrice: 40000, quantity: 30, minQuantity: 10, description: 'سماعات بلوتوث', image: null, createdAt: new Date().toISOString() },
            { id: 6, code: 'AC-004', name: 'واقي شاشة زجاجي', category: 'accessories', purchasePrice: 2000, salePrice: 5000, quantity: 3, minQuantity: 15, description: 'واقي شاشة', image: null, createdAt: new Date().toISOString() }
        ]);
        
        await this.storage.set('suppliers', [
            { id: 1, code: 'SUP-001', name: 'شركة التقنية المتقدمة', phone: '07701234567', address: 'بغداد', balance: 0, createdAt: new Date().toISOString() },
            { id: 2, code: 'SUP-002', name: 'مؤسسة النور', phone: '07809876543', address: 'بغداد', balance: 50000, createdAt: new Date().toISOString() }
        ]);
        
        await this.storage.set('customers', [
            { id: 1, code: 'CUS-001', name: 'أحمد محمد', phone: '07711112222', address: 'بغداد', balance: 0, createdAt: new Date().toISOString() },
            { id: 2, code: 'CUS-002', name: 'علي حسين', phone: '07722223333', address: 'بغداد', balance: 25000, createdAt: new Date().toISOString() }
        ]);
        
        await this.storage.set('sales', []);
        await this.storage.set('purchases', []);
        await this.storage.set('stockMovements', []);
        
        await this.storage.set('discounts', [
            { id: 1, code: 'WELCOME10', discount: 10, maxUses: 100, usedCount: 0, expiryDate: '2026-12-31', active: true, createdAt: new Date().toISOString() },
            { id: 2, code: 'SUMMER20', discount: 20, maxUses: 50, usedCount: 0, expiryDate: '2026-09-30', active: true, createdAt: new Date().toISOString() }
        ]);
        
        await this.storage.set('offers', {
            title: 'عروض الصيف',
            startTime: new Date().toISOString(),
            endTime: new Date(Date.now() + 86400000).toISOString(),
            products: []
        });
        
        await this.storage.set('chats', []);
        
        await this.storage.set('settings', { 
            storeName: 'Mi Store', 
            storeAddress: 'بغداد - العراق', 
            storePhone: '07700000000', 
            currency: 'IQD', 
            taxRate: 0 
        });
        
        await this.storage.set('about', {
            title: 'من نحن',
            description: 'Mi Store هو متجر متخصص في بيع إكسسوارات الهواتف الأصلية بأفضل الأسعار.',
            features: [
                { title: 'منتجات أصلية 100%', desc: 'جميع منتجاتنا أصلية ومضمونة' },
                { title: 'أسعار منافسة', desc: 'أفضل الأسعار في السوق' },
                { title: 'توصيل سريع', desc: 'توصيل خلال 24 ساعة' },
                { title: 'ضمان على جميع المنتجات', desc: 'ضمان استرجاع أو استبدال' }
            ],
            stats: { years: '5+ سنوات', customers: '1000+', products: '500+' }
        });
        
        await this.storage.set('initialized', true);
        console.log('✅ تم إنشاء جميع البيانات الافتراضية بنجاح');
    }
    
    // ===== التحقق من المصادقة =====
    async checkAuth() {
        const loginPage = document.getElementById('loginPage');
        const dashboardPage = document.getElementById('dashboardPage');
        
        if (loginPage) loginPage.classList.remove('active');
        if (dashboardPage) dashboardPage.classList.remove('active');
        
        if (this.auth.isAuthenticated()) {
            if (dashboardPage) dashboardPage.classList.add('active');
            if (loginPage) loginPage.classList.remove('active');
            this.initDashboard();
            console.log('✅ تم عرض لوحة التحكم');
        } else {
            if (loginPage) loginPage.classList.add('active');
            if (dashboardPage) dashboardPage.classList.remove('active');
            this.initLogin();
            console.log('✅ تم عرض صفحة تسجيل الدخول');
        }
    }
    
    // ===== تهيئة تسجيل الدخول =====
    initLogin() {
        const form = document.getElementById('loginForm');
        const toggleBtn = document.getElementById('togglePassword');
        const passwordInput = document.getElementById('password');
        const loginBtn = document.getElementById('loginBtn');
        const loginMessage = document.getElementById('loginMessage');
        
        const remembered = localStorage.getItem('mi_store_remembered');
        if (remembered) {
            try {
                const data = JSON.parse(remembered);
                document.getElementById('username').value = data.username || '';
                document.getElementById('rememberMe').checked = true;
            } catch { }
        }
        
        toggleBtn.addEventListener('click', () => {
            const icon = toggleBtn.querySelector('i');
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const password = passwordInput.value;
            const rememberMe = document.getElementById('rememberMe').checked;
            
            if (!username || !password) {
                loginMessage.textContent = 'يرجى إدخال جميع البيانات';
                loginMessage.className = 'login-message show error';
                return;
            }
            
            loginBtn.classList.add('loading');
            loginBtn.disabled = true;
            loginMessage.className = 'login-message';
            
            await new Promise(r => setTimeout(r, 700));
            
            const result = this.auth.login(username, password);
            
            loginBtn.classList.remove('loading');
            loginBtn.disabled = false;
            
            if (result.success) {
                if (rememberMe) {
                    localStorage.setItem('mi_store_remembered', JSON.stringify({ username }));
                } else {
                    localStorage.removeItem('mi_store_remembered');
                }
                
                loginMessage.textContent = 'تم تسجيل الدخول بنجاح!';
                loginMessage.className = 'login-message show success';
                
                setTimeout(() => {
                    const loginPage = document.getElementById('loginPage');
                    const dashboardPage = document.getElementById('dashboardPage');
                    
                    if (loginPage) {
                        loginPage.classList.remove('active');
                        loginPage.style.display = 'none';
                    }
                    
                    if (dashboardPage) {
                        dashboardPage.classList.add('active');
                        dashboardPage.style.display = 'flex';
                    }
                    
                    this.initDashboard();
                    console.log('✅ تم التحويل إلى لوحة التحكم');
                }, 800);
            } else {
                loginMessage.textContent = result.message;
                loginMessage.className = 'login-message show error';
                passwordInput.value = '';
            }
        });
    }
    
    // ===== تهيئة لوحة التحكم =====
    initDashboard() {
        const user = this.auth.getCurrentUser();
        if (user) {
            document.getElementById('userName').textContent = user.fullName;
            document.getElementById('userAvatar').textContent = user.fullName.charAt(0);
        }
        this.updateStats();
        this.renderRecentSales();
        this.renderLowStock();
        this.renderRecentChats();
        this.updateChatBadge();
        this.renderAllTables();
    }
    
    // ===== مستمعات الأحداث =====
    initEventListeners() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateTo(item.dataset.page);
            });
        });
        
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.modal.confirm('تسجيل الخروج', 'هل أنت متأكد؟', () => this.auth.logout());
        });
        
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
        });
        
        document.getElementById('menuToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('mobile-open');
        });
        
        document.getElementById('settingsForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveSettings();
        });
        
        const aboutForm = document.getElementById('aboutForm');
        if (aboutForm) {
            aboutForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveAboutSettings();
            });
        }
    }
    
    // ===== التنقل =====
    navigateTo(page) {
        this.currentPage = page;
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });
        document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
        const content = document.getElementById(page + 'Content');
        if (content) content.classList.add('active');
        
        const titles = { 
            dashboard: 'الرئيسية', products: 'المنتجات', inventory: 'المخزون', 
            sales: 'المبيعات', purchases: 'المشتريات', suppliers: 'الموردين', 
            customers: 'العملاء', discounts: 'أكواد الخصم', offers: 'عروض اليوم',
            chat: 'المحادثات', printing: 'الطباعة', reports: 'التقارير', settings: 'الإعدادات' 
        };
        document.getElementById('pageTitle').textContent = titles[page] || page;
        document.getElementById('sidebar').classList.remove('mobile-open');
        this.refreshPageContent(page);
    }
    
    refreshPageContent(page) {
        const map = {
            dashboard: () => { this.updateStats(); this.renderRecentSales(); this.renderLowStock(); this.renderRecentChats(); this.updateChatBadge(); },
            products: () => this.renderProductsTable(),
            inventory: () => this.renderInventoryTable(),
            sales: () => this.renderSalesTable(),
            purchases: () => this.renderPurchasesTable(),
            suppliers: () => this.renderSuppliersTable(),
            customers: () => this.renderCustomersTable(),
            discounts: () => this.renderDiscountsTable(),
            offers: () => { this.renderOffersTable(); this.loadOfferSettings(); },
            chat: () => { this.renderChatList(); if (this.currentChatId) this.openChat(this.currentChatId); },
            settings: () => this.loadSettings()
        };
        if (map[page]) map[page]();
    }
    
    // ===== الإحصائيات =====
    async updateStats() {
        const products = await this.storage.get('products', []);
        const sales = await this.storage.get('sales', []);
        const customers = await this.storage.get('customers', []);
        const today = new Date().toDateString();
        const todaySales = sales.filter(s => new Date(s.date).toDateString() === today);
        const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
        
        document.getElementById('totalProducts').textContent = products.length;
        document.getElementById('totalSales').textContent = todaySales.length;
        document.getElementById('totalRevenue').textContent = this.formatCurrency(todayRevenue);
        document.getElementById('totalCustomers').textContent = customers.length;
    }
    
    async renderRecentSales() {
        const sales = await this.storage.get('sales', []);
        const recent = sales.slice(-5).reverse();
        const container = document.getElementById('recentSalesList');
        if (recent.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-shopping-cart"></i><p>لا توجد مبيعات</p></div>';
            return;
        }
        container.innerHTML = recent.map(s => `
            <div class="list-item">
                <div class="list-item-info">
                    <div class="list-item-title">${s.invoiceNumber}</div>
                    <div class="list-item-subtitle">${s.customerName} - ${this.formatDate(s.date)}</div>
                </div>
                <div class="list-item-value">${this.formatCurrency(s.total)}</div>
            </div>
        `).join('');
    }
    
    async renderLowStock() {
        const products = await this.storage.get('products', []);
        const lowStock = products.filter(p => p.quantity <= p.minQuantity);
        const container = document.getElementById('lowStockList');
        if (lowStock.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><p>جميع المنتجات متوفرة</p></div>';
        } else {
            container.innerHTML = lowStock.map(p => `
                <div class="list-item">
                    <div class="list-item-info">
                        <div class="list-item-title">${p.name}</div>
                        <div class="list-item-subtitle">${p.code}</div>
                    </div>
                    <div class="list-item-value" style="color:${p.quantity === 0 ? 'var(--danger)' : 'var(--warning)'}">${p.quantity}</div>
                </div>
            `).join('');
        }
    }
        async renderRecentChats() {
        const chats = await this.storage.get('chats', []);
        const recent = chats.slice(-3).reverse();
        const container = document.getElementById('recentChatsList');
        if (recent.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-comments"></i><p>لا توجد محادثات</p></div>';
            return;
        }
        container.innerHTML = recent.map(c => `
            <div class="list-item" onclick="app.navigateTo('chat'); app.openChat(${c.id})" style="cursor:pointer">
                <div class="list-item-info">
                    <div class="list-item-title">${c.customerName}</div>
                    <div class="list-item-subtitle">${c.lastMessage.substring(0, 40)}...</div>
                </div>
                ${c.unread > 0 ? `<span class="status-badge danger">${c.unread}</span>` : ''}
            </div>
        `).join('');
    }
    
    async updateChatBadge() {
        const chats = await this.storage.get('chats', []);
        const totalUnread = chats.reduce((sum, c) => sum + (c.unread || 0), 0);
        const badge = document.getElementById('notificationsBadge');
        badge.textContent = totalUnread;
        badge.style.display = totalUnread > 0 ? 'flex' : 'none';
        if (totalUnread > 0) badge.classList.add('pulse');
        else badge.classList.remove('pulse');
    }
    
    async renderAllTables() {
        await this.renderProductsTable();
        await this.renderInventoryTable();
        await this.renderSalesTable();
        await this.renderPurchasesTable();
        await this.renderSuppliersTable();
        await this.renderCustomersTable();
    }
    
    // ===== المنتجات =====
    async renderProductsTable() {
        const products = await this.storage.get('products', []);
        const search = (document.getElementById('productSearch')?.value || '').toLowerCase();
        const category = document.getElementById('categoryFilter')?.value || '';
        const filtered = products.filter(p => {
            const matchSearch = !search || p.name.toLowerCase().includes(search) || p.code.toLowerCase().includes(search);
            const matchCategory = !category || p.category === category;
            return matchSearch && matchCategory;
        });
        const tbody = document.getElementById('productsTableBody');
        if (!tbody) return;
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-box-open"></i><p>لا توجد منتجات</p></div></td></tr>';
            return;
        }
        const categories = { phones: 'هواتف', accessories: 'إكسسوارات', chargers: 'شواحن', cases: 'كفرات' };
        tbody.innerHTML = filtered.map(p => `
            <tr>
                <td><strong>${p.code}</strong></td>
                <td>${p.name}</td>
                <td><span class="status-badge info">${categories[p.category] || p.category}</span></td>
                <td>${this.formatCurrency(p.purchasePrice)}</td>
                <td><strong>${this.formatCurrency(p.salePrice)}</strong></td>
                <td><span class="status-badge ${p.quantity === 0 ? 'danger' : p.quantity <= p.minQuantity ? 'warning' : 'success'}">${p.quantity}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn edit" onclick="app.editProduct(${p.id})"><i class="fas fa-edit"></i></button>
                        <button class="action-btn delete" onclick="app.deleteProduct(${p.id})"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    showAddProductModal() { this.openProductModal(); }
    
    openProductModal(product = null) {
        const isEdit = !!product;
        this.selectedProductImage = product?.image || null;
        
        const body = `
            <form id="productForm">
                <div class="form-row">
                    <div class="form-group"><label>كود المنتج *</label><input type="text" class="form-input" id="pCode" value="${product?.code || ''}" required></div>
                    <div class="form-group"><label>الفئة *</label>
                        <select class="form-select" id="pCategory" required>
                            <option value="phones" ${product?.category === 'phones' ? 'selected' : ''}>هواتف</option>
                            <option value="accessories" ${product?.category === 'accessories' ? 'selected' : ''}>إكسسوارات</option>
                            <option value="chargers" ${product?.category === 'chargers' ? 'selected' : ''}>شواحن</option>
                            <option value="cases" ${product?.category === 'cases' ? 'selected' : ''}>كفرات</option>
                        </select>
                    </div>
                </div>
                <div class="form-group"><label>اسم المنتج *</label><input type="text" class="form-input" id="pName" value="${product?.name || ''}" required></div>
                <div class="form-row">
                    <div class="form-group"><label>سعر الشراء *</label><input type="number" class="form-input" id="pPurchasePrice" value="${product?.purchasePrice || ''}" min="0" required></div>
                    <div class="form-group"><label>سعر البيع *</label><input type="number" class="form-input" id="pSalePrice" value="${product?.salePrice || ''}" min="0" required></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>الكمية *</label><input type="number" class="form-input" id="pQuantity" value="${product?.quantity ?? 0}" min="0" required></div>
                    <div class="form-group"><label>الحد الأدنى</label><input type="number" class="form-input" id="pMinQuantity" value="${product?.minQuantity ?? 5}" min="0"></div>
                </div>
                <div class="form-group">
                    <label>صورة المنتج</label>
                    <input type="file" id="pImage" class="form-input" accept="image/*" onchange="app.previewImage(this)">
                    ${product?.image ? `
                        <div style="margin-top: 10px;">
                            <img src="${product.image}" alt="الصورة الحالية" style="max-width: 200px; border-radius: 8px; border: 2px solid var(--border-color);">
                            <p style="font-size: 12px; color: var(--text-muted); margin-top: 5px;">📷 الصورة الحالية محفوظة</p>
                        </div>
                    ` : `
                        <div id="imagePreview" style="margin-top: 10px; display: none;">
                            <img id="previewImg" src="" alt="معاينة" style="max-width: 200px; border-radius: 8px; border: 2px solid var(--border-color);">
                            <p style="font-size: 12px; color: var(--success); margin-top: 5px;">✅ تم اختيار الصورة</p>
                        </div>
                    `}
                </div>
                <div class="form-group"><label>الوصف</label><textarea class="form-textarea" id="pDescription">${product?.description || ''}</textarea></div>
            </form>
        `;
        const footer = `
            <button class="btn btn-outline" onclick="app.modal.close()">إلغاء</button>
            <button class="btn btn-primary" onclick="app.saveProduct(${product?.id || 'null'})"><i class="fas fa-save"></i> ${isEdit ? 'تحديث' : 'حفظ'}</button>
        `;
        this.modal.open(isEdit ? 'تعديل المنتج' : 'إضافة منتج جديد', body, footer);
    }
    
    previewImage(input) {
    console.log('📸 تم اختيار ملف:', input.files?.[0]?.name);
    const preview = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    
    if (input.files && input.files[0]) {
        const file = input.files[0];
        console.log(' حجم الملف:', (file.size / 1024).toFixed(2), 'KB');
        
        // التحقق من نوع الملف
        if (!file.type.startsWith('image/')) {
            alert('⚠️ الملف المحدد ليس صورة!');
            return;
        }
        
        // التحقق من الحجم (2MB كحد أقصى)
        const maxSize = 2 * 1024 * 1024;
        if (file.size > maxSize) {
            alert(`⚠️ حجم الصورة كبير جداً! (${(file.size / 1024 / 1024).toFixed(2)} MB). الحد الأقصى 2MB`);
            return;
        }
        
        // ✅ حفظ الصورة في المتغير (هذا هو الإصلاح!)
        this.selectedProductImage = file;
        console.log('✅ تم حفظ الصورة في المتغير selectedProductImage');
        
        // عرض المعاينة
        const reader = new FileReader();
        reader.onload = function (e) {
            previewImg.src = e.target.result;
            preview.style.display = 'block';
            console.log('✅ تم عرض معاينة الصورة بنجاح');
        };
        reader.onerror = function () {
            alert('❌ خطأ في قراءة الملف');
        };
        reader.readAsDataURL(file);
    }
}
    
    compressImage(file, maxWidth = 800, quality = 0.7) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                    const byteString = atob(compressedDataUrl.split(',')[1]);
                    const ab = new ArrayBuffer(byteString.length);
                    const ia = new Uint8Array(ab);
                    for (let i = 0; i < byteString.length; i++) {
                        ia[i] = byteString.charCodeAt(i);
                    }
                    const blob = new Blob([ab], { type: 'image/jpeg' });
                    const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), { type: 'image/jpeg' });
                    
                    console.log('🗜️ تم ضغط الصورة:');
                    console.log('   الحجم الأصلي:', (file.size / 1024).toFixed(2), 'KB');
                    console.log('   الحجم بعد الضغط:', (compressedFile.size / 1024).toFixed(2), 'KB');
                    console.log('   نسبة الضغط:', ((1 - compressedFile.size / file.size) * 100).toFixed(1), '%');
                    
                    resolve(compressedFile);
                };
                img.onerror = () => reject(new Error('فشل في تحميل الصورة للضغط'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('فشل في قراءة الملف'));
            reader.readAsDataURL(file);
        });
    }
    
    async uploadImageToImgBB(file) {
        const API_KEY = 'aa486b5eb4e44ab46aad73a3420b0270';
        console.log('📸 بدء رفع الصورة إلى ImgBB...');
        
        let compressedFile;
        try {
            compressedFile = await this.compressImage(file, 800, 0.7);
        } catch (error) {
            console.warn('⚠️ فشل ضغط الصورة:', error);
            compressedFile = file;
        }
        
        const formData = new FormData();
        formData.append('image', compressedFile);
        formData.append('key', API_KEY);
        
        try {
            const response = await fetch('https://api.imgbb.com/1/upload', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            console.log('📥 استجابة ImgBB:', data);
            
            if (data.success && data.data) {
                const imageUrl = data.data.url || data.data.display_url;
                console.log('✅ تم رفع الصورة بنجاح!');
                console.log('🔗 رابط الصورة:', imageUrl);
                
                if (!imageUrl || !imageUrl.startsWith('http')) {
                    throw new Error('الرابط المستلم غير صالح: ' + imageUrl);
                }
                
                return imageUrl;
            } else {
                throw new Error(data.error?.message || 'فشل غير معروف');
            }
        } catch (error) {
            console.error('❌ خطأ في رفع الصورة:', error);
            throw error;
        }
    }
    
    async saveProduct(id) {
    console.log('💾 بدء عملية حفظ المنتج...');
    console.log('🔑 ID:', id ? `تعديل منتج #${id}` : 'منتج جديد');
    
    try {
        // ===== 1. جمع البيانات من النموذج =====
        const code = document.getElementById('pCode').value.trim();
        const name = document.getElementById('pName').value.trim();
        const category = document.getElementById('pCategory').value;
        const purchasePrice = parseFloat(document.getElementById('pPurchasePrice').value);
        const salePrice = parseFloat(document.getElementById('pSalePrice').value);
        const quantity = parseInt(document.getElementById('pQuantity').value);
        const minQuantity = parseInt(document.getElementById('pMinQuantity').value) || 5;
        const description = document.getElementById('pDescription').value.trim();
        
        console.log('📝 البيانات المجمعة:', { code, name, category, purchasePrice, salePrice, quantity });
        
        // ===== 2. التحقق من صحة البيانات =====
        if (!code || !name || isNaN(purchasePrice) || isNaN(salePrice) || isNaN(quantity)) {
            console.error('❌ بيانات غير كاملة');
            this.toast.error('خطأ', 'يرجى ملء جميع الحقول المطلوبة');
            return;
        }
        
        // ===== 3. معالجة الصورة - رفعها إلى ImgBB =====
        // ===== 3. معالجة الصورة =====
let imageUrl = null;
const imageInput = document.getElementById('pImage');

// ✅ استخدام الصورة من المتغير (المحفوظة عند الاختيار)
const fileToUpload = this.selectedProductImage || (imageInput?.files?.[0]);

if (fileToUpload) {
    console.log('📸 الصورة المختارة:');
    console.log('   الاسم:', fileToUpload.name);
    console.log('   الحجم:', (fileToUpload.size / 1024).toFixed(2), 'KB');
    console.log('   النوع:', fileToUpload.type);
    
    // إظهار رسالة للمستخدم
    this.toast.info('جاري', 'جاري ضغط ورفع الصورة إلى ImgBB...');
    
    try {
        // رفع الصورة إلى ImgBB (مع ضغط تلقائي)
        imageUrl = await this.uploadImageToImgBB(fileToUpload);
        console.log('✅ تم رفع الصورة بنجاح!');
        console.log('🔗 رابط الصورة:', imageUrl);
    } catch (error) {
        console.error('❌ فشل رفع الصورة:', error);
        this.toast.error('خطأ', 'فشل رفع الصورة: ' + error.message);
        return; // إيقاف العملية
    }
} else {
    console.log('⚠️ لم يتم اختيار صورة جديدة');
}
        
        // ===== 4. جلب المنتجات الحالية من Firebase =====
        const products = await this.storage.get('products', []);
        console.log('📦 عدد المنتجات الحالي:', products.length);
        
        // ===== 5. حفظ أو تحديث المنتج =====
        if (id) {
            // ===== تعديل منتج موجود =====
            console.log('✏️ تعديل منتج موجود...');
            const index = products.findIndex(p => p.id === id);
            if (index !== -1) {
                const existingProduct = products[index];
                products[index] = { 
                    ...existingProduct, 
                    code, name, category, purchasePrice, salePrice, quantity, minQuantity, description,
                    // استخدام الصورة الجديدة إن وجدت، وإلا الاحتفاظ بالقديمة
                    image: imageUrl || existingProduct.image,
                    updatedAt: new Date().toISOString()
                };
                
                // حفظ في Firebase
                await this.storage.set('products', products);
                console.log('✅ تم تحديث المنتج في Firebase');
                this.toast.success('تم', `تم تحديث المنتج "${name}" بنجاح`);
            } else {
                console.error('❌ المنتج غير موجود');
                this.toast.error('خطأ', 'المنتج غير موجود');
                return;
            }
        } else {
            // ===== إضافة منتج جديد =====
            console.log('➕ إضافة منتج جديد...');
            
            // حساب ID جديد
            const newId = products.length > 0 
                ? Math.max(...products.map(p => p.id)) + 1 
                : 1;
            
            const newProduct = { 
                id: newId, 
                code, name, category, purchasePrice, salePrice, quantity, minQuantity, description, 
                image: imageUrl, // ✅ رابط الصورة من ImgBB
                createdAt: new Date().toISOString() 
            };
            
            products.push(newProduct);
            
            // حفظ في Firebase
            await this.storage.set('products', products);
            console.log('✅ تم إضافة المنتج الجديد بنجاح');
            console.log('🆔 ID المنتج الجديد:', newId);
            this.toast.success('تم', `تم إضافة المنتج "${name}" بنجاح`);
        }
        
        // ===== 6. إعادة تعيين الحقول =====
        console.log('🔄 إعادة تعيين الحقول...');
        this.selectedProductImage = null;
        
        if (imageInput) {
            imageInput.value = '';
            console.log('✅ تم إعادة تعيين حقل الصورة');
        }
        
        // إخفاء المعاينة
        const preview = document.getElementById('imagePreview');
        if (preview) {
            preview.style.display = 'none';
        }
        
        // ===== 7. إغلاق النافذة وتحديث الواجهة =====
        this.modal.close();
        await this.renderProductsTable();
        await this.renderInventoryTable();
        await this.updateStats();
        await this.renderLowStock();
        
        // ===== 8. فحص المنتجات المحفوظة =====
        const savedProducts = await this.storage.get('products', []);
        console.log('📊 المنتجات المحفوظة:', savedProducts.length);
        savedProducts.forEach((p, idx) => {
            const imageStatus = p.image 
                ? `✅ صورة (${p.image.substring(0, 40)}...)` 
                : '❌ بدون صورة';
            console.log(`   ${idx + 1}. ${p.name} - ${imageStatus}`);
        });
        
        console.log('=================================');
        console.log('✅ تم حفظ المنتج بنجاح');
        console.log('=================================');
        
    } catch (error) {
        console.error('❌ خطأ غير متوقع في saveProduct:', error);
        console.error('Stack:', error.stack);
        this.toast.error('خطأ', 'حدث خطأ: ' + error.message);
    }
}
    
    async editProduct(id) {
        const products = await this.storage.get('products', []);
        const product = products.find(p => p.id === id);
        if (product) this.openProductModal(product);
    }
    
    async deleteProduct(id) {
        this.modal.confirm('حذف المنتج', 'هل أنت متأكد؟', async () => {
            let products = await this.storage.get('products', []);
            products = products.filter(p => p.id !== id);
            await this.storage.set('products', products);
            this.toast.success('تم', 'تم حذف المنتج');
            await this.renderProductsTable();
            await this.renderInventoryTable();
            await this.updateStats();
            await this.renderLowStock();
        });
    }
    
    // ===== المخزون =====
    async renderInventoryTable() {
        const products = await this.storage.get('products', []);
        const tbody = document.getElementById('inventoryTableBody');
        if (!tbody) return;
        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-warehouse"></i><p>لا توجد منتجات</p></div></td></tr>';
            return;
        }
        tbody.innerHTML = products.map(p => {
            let status, statusClass;
            if (p.quantity === 0) { status = 'نفذ'; statusClass = 'danger'; }
            else if (p.quantity <= p.minQuantity) { status = 'منخفض'; statusClass = 'warning'; }
            else { status = 'متوفر'; statusClass = 'success'; }
            return `
                <tr>
                    <td><strong>${p.code}</strong></td>
                    <td>${p.name}</td>
                    <td><strong>${p.quantity}</strong></td>
                    <td>${p.minQuantity}</td>
                    <td><span class="status-badge ${statusClass}">${status}</span></td>
                    <td>${this.formatDate(p.createdAt)}</td>
                </tr>
            `;
        }).join('');
    }
    
    async showStockInModal() {
        const products = await this.storage.get('products', []);
        if (products.length === 0) { this.toast.warning('تنبيه', 'أضف منتجات أولاً'); return; }
        const body = `
            <form id="stockInForm">
                <div class="form-group"><label>المنتج *</label>
                    <select class="form-select" id="stockProduct" required>
                        <option value="">-- اختر --</option>
                        ${products.map(p => `<option value="${p.id}" data-price="${p.purchasePrice}">${p.code} - ${p.name} (الرصيد: ${p.quantity})</option>`).join('')}
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>الكمية *</label><input type="number" class="form-input" id="stockQty" min="1" required></div>
                    <div class="form-group"><label>سعر الشراء</label><input type="number" class="form-input" id="stockPrice" min="0"></div>
                </div>
                <div class="form-group"><label>ملاحظات</label><textarea class="form-textarea" id="stockNotes"></textarea></div>
            </form>
        `;
        const footer = `
            <button class="btn btn-outline" onclick="app.modal.close()">إلغاء</button>
            <button class="btn btn-success" onclick="app.saveStockMovement('in')"><i class="fas fa-arrow-down"></i> تسجيل الوارد</button>
        `;
        this.modal.open('تسجيل وارد', body, footer);
        document.getElementById('stockProduct').addEventListener('change', (e) => {
            const option = e.target.options[e.target.selectedIndex];
            if (option.dataset.price) document.getElementById('stockPrice').value = option.dataset.price;
        });
    }
    
    async showStockOutModal() {
        const products = await this.storage.get('products', []);
        if (products.length === 0) { this.toast.warning('تنبيه', 'لا توجد منتجات'); return; }
        const body = `
            <form id="stockOutForm">
                <div class="form-group"><label>المنتج *</label>
                    <select class="form-select" id="stockProduct" required>
                        <option value="">-- اختر --</option>
                        ${products.filter(p => p.quantity > 0).map(p => `<option value="${p.id}">${p.code} - ${p.name} (الرصيد: ${p.quantity})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group"><label>الكمية *</label><input type="number" class="form-input" id="stockQty" min="1" required></div>
                <div class="form-group"><label>السبب</label>
                    <select class="form-select" id="stockReason">
                        <option value="damage">تالف</option>
                        <option value="return">مرتجع</option>
                        <option value="loss">فقدان</option>
                        <option value="other">أخرى</option>
                    </select>
                </div>
                <div class="form-group"><label>ملاحظات</label><textarea class="form-textarea" id="stockNotes"></textarea></div>
            </form>
        `;
        const footer = `
            <button class="btn btn-outline" onclick="app.modal.close()">إلغاء</button>
            <button class="btn btn-warning" onclick="app.saveStockMovement('out')"><i class="fas fa-arrow-up"></i> تسجيل الصادر</button>
        `;
        this.modal.open('تسجيل صادر', body, footer);
    }
    
    async saveStockMovement(type) {
        const productId = parseInt(document.getElementById('stockProduct').value);
        const qty = parseInt(document.getElementById('stockQty').value);
        const notes = document.getElementById('stockNotes').value.trim();
        
        if (!productId || !qty || qty <= 0) { this.toast.error('خطأ', 'بيانات غير صحيحة'); return; }
        
        const products = await this.storage.get('products', []);
        const product = products.find(p => p.id === productId);
        if (!product) return;
        
        if (type === 'out' && qty > product.quantity) {
            this.toast.error('خطأ', `الكمية أكبر من الرصيد (${product.quantity})`);
            return;
        }
        
        if (type === 'in') {
            product.quantity += qty;
            const price = parseFloat(document.getElementById('stockPrice').value);
            if (!isNaN(price) && price > 0) product.purchasePrice = price;
        } else {
            product.quantity -= qty;
        }
        
        await this.storage.set('products', products);
        
        const movements = await this.storage.get('stockMovements', []);
        movements.push({
            id: movements.length + 1, productId, productName: product.name,
            type, quantity: qty, price: product.purchasePrice, notes,
            date: new Date().toISOString(), user: this.auth.getCurrentUser()?.fullName || 'admin'
        });
        await this.storage.set('stockMovements', movements);
        
        this.modal.close();
        this.toast.success('تم', `تم تسجيل ${type === 'in' ? 'الوارد' : 'الصادر'}`);
        await this.renderInventoryTable();
        await this.renderProductsTable();
        await this.updateStats();
        await this.renderLowStock();
    }
    
    // ===== المبيعات =====
    async renderSalesTable() {
        const sales = await this.storage.get('sales', []);
        const tbody = document.getElementById('salesTableBody');
        if (!tbody) return;
        if (sales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-cash-register"></i><p>لا توجد مبيعات</p></div></td></tr>';
            return;
        }
        tbody.innerHTML = sales.slice().reverse().map(sale => `
            <tr>
                <td><strong>${sale.invoiceNumber}</strong></td>
                <td>${this.formatDateTime(sale.date)}</td>
                <td>${sale.customerName || 'عميل نقدي'}</td>
                <td><strong>${this.formatCurrency(sale.total)}</strong></td>
                <td><span class="status-badge ${sale.status === 'paid' ? 'success' : sale.status === 'pending' ? 'warning' : 'danger'}">${sale.status === 'paid' ? 'مدفوعة' : sale.status === 'pending' ? 'معلقة' : 'ملغاة'}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn view" onclick="app.viewSale(${sale.id})"><i class="fas fa-eye"></i></button>
                        <button class="action-btn print" onclick="app.printSale(${sale.id})"><i class="fas fa-print"></i></button>
                        ${sale.status !== 'cancelled' ? `<button class="action-btn delete" onclick="app.cancelSale(${sale.id})"><i class="fas fa-ban"></i></button>` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    async showNewSaleModal() {
        this.cart = [];
        const customers = await this.storage.get('customers', []);
        const products = await this.storage.get('products', []);
        const body = `
            <div class="form-group"><label>العميل</label>
                <select class="form-select" id="saleCustomer">
                    <option value="">عميل نقدي</option>
                    ${customers.map(c => `<option value="${c.id}">${c.name} - ${c.phone}</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>إضافة منتج</label>
                <div style="display:flex;gap:8px">
                    <select class="form-select" id="saleProductSelect" style="flex:2">
                        <option value="">-- اختر منتج --</option>
                        ${products.filter(p => p.quantity > 0).map(p => `<option value="${p.id}" data-price="${p.salePrice}" data-stock="${p.quantity}">${p.code} - ${p.name} (${this.formatCurrency(p.salePrice)}) - متوفر: ${p.quantity}</option>`).join('')}
                    </select>
                    <input type="number" class="form-input" id="saleProductQty" value="1" min="1" style="flex:1" placeholder="الكمية">
                    <button type="button" class="btn btn-primary" onclick="app.addToCart()"><i class="fas fa-plus"></i></button>
                </div>
            </div>
            <div class="invoice-cart" id="invoiceCart"><div class="empty-state"><i class="fas fa-shopping-basket"></i><p>السلة فارغة</p></div></div>
            <div class="invoice-totals">
                <div class="total-row"><span>المجموع:</span><span id="cartSubtotal">0 د.ع</span></div>
                <div class="total-row"><span>الخصم:</span><input type="number" id="cartDiscount" value="0" min="0" class="form-input" style="width:120px;display:inline-block;padding:4px 8px" oninput="app.updateCartTotals()"><span>د.ع</span></div>
                <div class="total-row grand-total"><span>الإجمالي:</span><span id="cartGrandTotal">0 د.ع</span></div>
            </div>
            <div class="form-row mt-2">
                <div class="form-group"><label>طريقة الدفع</label>
                    <select class="form-select" id="salePayment">
                        <option value="cash">نقدي</option>
                        <option value="card">بطاقة</option>
                        <option value="credit">آجل</option>
                    </select>
                </div>
                <div class="form-group"><label>المبلغ المدفوع</label><input type="number" class="form-input" id="salePaid" value="0" min="0"></div>
            </div>
            <div class="form-group"><label>ملاحظات</label><textarea class="form-textarea" id="saleNotes" style="min-height:60px"></textarea></div>
        `;
        const footer = `
            <button class="btn btn-outline" onclick="app.modal.close()">إلغاء</button>
            <button class="btn btn-success" onclick="app.saveSale()"><i class="fas fa-check"></i> حفظ الفاتورة</button>
        `;
        this.modal.open('فاتورة مبيعات جديدة', body, footer);
    }
    
    async addToCart() {
        const select = document.getElementById('saleProductSelect');
        const qty = parseInt(document.getElementById('saleProductQty').value);
        if (!select.value) { this.toast.warning('تنبيه', 'اختر منتج'); return; }
        if (!qty || qty <= 0) { this.toast.warning('تنبيه', 'كمية غير صحيحة'); return; }
        
        const option = select.options[select.selectedIndex];
        const productId = parseInt(select.value);
        const price = parseFloat(option.dataset.price);
        const stock = parseInt(option.dataset.stock);
        const productName = option.textContent.split(' - ')[1];
        
        if (qty > stock) { this.toast.error('خطأ', `الكمية أكبر من المتوفر (${stock})`); return; }
        
        const existing = this.cart.find(item => item.productId === productId);
        if (existing) {
            const newQty = existing.quantity + qty;
            if (newQty > stock) { this.toast.error('خطأ', `إجمالي الكمية أكبر من المتوفر`); return; }
            existing.quantity = newQty;
            existing.total = newQty * existing.price;
        } else {
            this.cart.push({ productId, productName, price, quantity: qty, total: qty * price });
        }
        this.renderCart();
        select.value = '';
        document.getElementById('saleProductQty').value = 1;
    }
    
    renderCart() {
        const container = document.getElementById('invoiceCart');
        if (!container) return;
        if (this.cart.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-shopping-basket"></i><p>السلة فارغة</p></div>';
            this.updateCartTotals();
            return;
        }
        container.innerHTML = this.cart.map((item, idx) => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.productName}</div>
                    <div class="cart-item-price">${this.formatCurrency(item.price)} × ${item.quantity}</div>
                </div>
                <div class="cart-item-qty">
                    <button class="qty-btn" onclick="app.updateCartQty(${idx}, -1)"><i class="fas fa-minus"></i></button>
                    <input type="number" class="qty-input" value="${item.quantity}" min="1" onchange="app.setCartQty(${idx}, this.value)">
                    <button class="qty-btn" onclick="app.updateCartQty(${idx}, 1)"><i class="fas fa-plus"></i></button>
                </div>
                <div class="cart-item-total">${this.formatCurrency(item.total)}</div>
                <button class="action-btn delete" onclick="app.removeFromCart(${idx})"><i class="fas fa-trash"></i></button>
            </div>
        `).join('');
        this.updateCartTotals();
    }
    
    async updateCartQty(idx, delta) {
        const item = this.cart[idx];
        if (!item) return;
        const products = await this.storage.get('products', []);
        const product = products.find(p => p.id === item.productId);
        const newQty = item.quantity + delta;
        if (newQty <= 0) { this.removeFromCart(idx); return; }
        if (product && newQty > product.quantity) { this.toast.warning('تنبيه', 'لا يمكن تجاوز الكمية المتوفرة'); return; }
        item.quantity = newQty;
        item.total = newQty * item.price;
        this.renderCart();
    }
    
    async setCartQty(idx, value) {
        const qty = parseInt(value);
        if (!qty || qty <= 0) { this.removeFromCart(idx); return; }
        const item = this.cart[idx];
        const products = await this.storage.get('products', []);
        const product = products.find(p => p.id === item.productId);
        if (product && qty > product.quantity) { this.toast.warning('تنبيه', 'الكمية أكبر من المتوفر'); item.quantity = product.quantity; }
        else item.quantity = qty;
        item.total = item.quantity * item.price;
        this.renderCart();
    }
    
    removeFromCart(idx) { this.cart.splice(idx, 1); this.renderCart(); }
    
    updateCartTotals() {
        const subtotal = this.cart.reduce((sum, item) => sum + item.total, 0);
        const discount = parseFloat(document.getElementById('cartDiscount')?.value || 0);
        const grandTotal = Math.max(0, subtotal - discount);
        const subtotalEl = document.getElementById('cartSubtotal');
        const grandTotalEl = document.getElementById('cartGrandTotal');
        const paidEl = document.getElementById('salePaid');
        if (subtotalEl) subtotalEl.textContent = this.formatCurrency(subtotal);
        if (grandTotalEl) grandTotalEl.textContent = this.formatCurrency(grandTotal);
        if (paidEl && paidEl.value === '0') paidEl.value = grandTotal;
    }
    
    async saveSale() {
        if (this.cart.length === 0) { this.toast.warning('تنبيه', 'السلة فارغة!'); return; }
        
        const customerId = parseInt(document.getElementById('saleCustomer').value) || null;
        const customers = await this.storage.get('customers', []);
        const customer = customers.find(c => c.id === customerId);
        
        const subtotal = this.cart.reduce((sum, item) => sum + item.total, 0);
        const discount = parseFloat(document.getElementById('cartDiscount').value) || 0;
        const settings = await this.storage.get('settings', {});
        const taxRate = settings.taxRate || 0;
        const tax = (subtotal - discount) * (taxRate / 100);
        const total = subtotal - discount + tax;
        const paid = parseFloat(document.getElementById('salePaid').value) || 0;
        const paymentMethod = document.getElementById('salePayment').value;
        const notes = document.getElementById('saleNotes').value.trim();
        
        let status = 'paid';
        if (paymentMethod === 'credit') status = 'pending';
        else if (paid < total) status = 'pending';
        
        const sales = await this.storage.get('sales', []);
        const sale = {
            id: sales.length > 0 ? Math.max(...sales.map(s => s.id)) + 1 : 1,
            invoiceNumber: this.generateInvoiceNumber('INV'),
            date: new Date().toISOString(),
            customerId, customerName: customer?.name || 'عميل نقدي',
            customerPhone: customer?.phone || '',
            items: this.cart.map(item => ({ ...item })),
            subtotal, discount, tax, total, paid, remaining: Math.max(0, total - paid),
            paymentMethod, notes, status,
            user: this.auth.getCurrentUser()?.fullName || 'admin'
        };
        sales.push(sale);
        await this.storage.set('sales', sales);
        
        const products = await this.storage.get('products', []);
        for (const cartItem of this.cart) {
            const product = products.find(p => p.id === cartItem.productId);
            if (product) {
                product.quantity -= cartItem.quantity;
                const movements = await this.storage.get('stockMovements', []);
                movements.push({
                    id: movements.length + 1,
                    productId: product.id, productName: product.name,
                    type: 'sale', quantity: cartItem.quantity, price: cartItem.price,
                    reference: sale.invoiceNumber, date: sale.date, user: sale.user
                });
                await this.storage.set('stockMovements', movements);
            }
        }
        await this.storage.set('products', products);
        
        if (customerId && sale.remaining > 0) {
            const customer = customers.find(c => c.id === customerId);
            if (customer) {
                customer.balance = (customer.balance || 0) + sale.remaining;
                await this.storage.set('customers', customers);
            }
        }
        
        this.modal.close();
        this.toast.success('تم', `تم حفظ الفاتورة ${sale.invoiceNumber}`);
        this.printSale(sale.id);
        this.cart = [];
        await this.renderSalesTable();
        await this.renderInventoryTable();
        await this.renderProductsTable();
        await this.updateStats();
        await this.renderRecentSales();
        await this.renderLowStock();
    }
    
    async viewSale(id) {
        const sales = await this.storage.get('sales', []);
        const sale = sales.find(s => s.id === id);
        if (!sale) return;
        const body = `
            <div class="print-invoice">
                <div class="print-header"><h1>Mi Store</h1><p>فاتورة مبيعات</p></div>
                <div class="print-info">
                    <div class="print-info-block"><h4>رقم الفاتورة</h4><p>${sale.invoiceNumber}</p></div>
                    <div class="print-info-block"><h4>التاريخ</h4><p>${this.formatDateTime(sale.date)}</p></div>
                    <div class="print-info-block"><h4>العميل</h4><p>${sale.customerName}</p></div>
                    <div class="print-info-block"><h4>الحالة</h4><p>${sale.status === 'paid' ? 'مدفوعة' : sale.status === 'pending' ? 'معلقة' : 'ملغاة'}</p></div>
                </div>
                <table class="print-table">
                    <thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
                    <tbody>${sale.items.map(item => `<tr><td>${item.productName}</td><td>${item.quantity}</td><td>${this.formatCurrency(item.price)}</td><td>${this.formatCurrency(item.total)}</td></tr>`).join('')}</tbody>
                </table>
                <div class="print-totals">
                    <div class="total-row"><span>المجموع:</span><span>${this.formatCurrency(sale.subtotal)}</span></div>
                    ${sale.discount > 0 ? `<div class="total-row"><span>الخصم:</span><span>${this.formatCurrency(sale.discount)}</span></div>` : ''}
                    <div class="total-row grand-total"><span>الإجمالي:</span><span>${this.formatCurrency(sale.total)}</span></div>
                    <div class="total-row"><span>المدفوع:</span><span>${this.formatCurrency(sale.paid || sale.total)}</span></div>
                    ${sale.remaining > 0 ? `<div class="total-row text-danger"><span>المتبقي:</span><span>${this.formatCurrency(sale.remaining)}</span></div>` : ''}
                </div>
            </div>
        `;
        const footer = `
            <button class="btn btn-outline" onclick="app.modal.close()">إغلاق</button>
            <button class="btn btn-primary" onclick="app.printSale(${sale.id})"><i class="fas fa-print"></i> طباعة</button>
        `;
        this.modal.open(`فاتورة ${sale.invoiceNumber}`, body, footer);
    }
    
    async printSale(id) {
        const sales = await this.storage.get('sales', []);
        const sale = sales.find(s => s.id === id);
        if (!sale) return;
        const settings = await this.storage.get('settings', {});
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        printWindow.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>فاتورة ${sale.invoiceNumber}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Tahoma,Arial;padding:20px}
.header{text-align:center;border-bottom:3px solid #FF6700;padding-bottom:15px;margin-bottom:20px}
.header h1{color:#FF6700;font-size:32px}.header p{color:#6c757d;font-size:14px}
.info{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px}
.info-block{background:#f8f9fa;padding:10px;border-radius:6px}
.info-block h4{font-size:12px;color:#6c757d;margin-bottom:3px}.info-block p{font-size:14px;font-weight:600}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
th{background:#FF6700;color:white;padding:10px;text-align:right;font-size:13px}
td{padding:10px;border-bottom:1px solid #dee2e6;font-size:13px}
.totals{margin-right:auto;width:300px}.totals .row{display:flex;justify-content:space-between;padding:5px 0}
.totals .grand{font-size:18px;font-weight:800;color:#FF6700;border-top:2px solid #FF6700;padding-top:8px;margin-top:8px}
.footer{margin-top:40px;text-align:center;color:#6c757d;font-size:12px;border-top:1px solid #dee2e6;padding-top:15px}</style></head>
<body><div class="header"><h1>${settings.storeName || 'Mi Store'}</h1><p>${settings.storeAddress || ''} - ${settings.storePhone || ''}</p><p style="margin-top:8px;font-size:16px;font-weight:700">فاتورة مبيعات</p></div>
<div class="info"><div class="info-block"><h4>رقم الفاتورة</h4><p>${sale.invoiceNumber}</p></div><div class="info-block"><h4>التاريخ</h4><p>${this.formatDateTime(sale.date)}</p></div><div class="info-block"><h4>العميل</h4><p>${sale.customerName}</p></div><div class="info-block"><h4>طريقة الدفع</h4><p>${sale.paymentMethod === 'cash' ? 'نقدي' : sale.paymentMethod === 'card' ? 'بطاقة' : 'آجل'}</p></div></div>
<table><thead><tr><th>#</th><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${sale.items.map((item, i) => `<tr><td>${i + 1}</td><td>${item.productName}</td><td>${item.quantity}</td><td>${this.formatCurrency(item.price)}</td><td>${this.formatCurrency(item.total)}</td></tr>`).join('')}</tbody></table>
<div class="totals"><div class="row"><span>المجموع:</span><span>${this.formatCurrency(sale.subtotal)}</span></div>${sale.discount > 0 ? `<div class="row"><span>الخصم:</span><span>${this.formatCurrency(sale.discount)}</span></div>` : ''}<div class="row grand"><span>الإجمالي:</span><span>${this.formatCurrency(sale.total)}</span></div><div class="row"><span>المدفوع:</span><span>${this.formatCurrency(sale.paid || sale.total)}</span></div>${sale.remaining > 0 ? `<div class="row" style="color:#E74C3C"><span>المتبقي:</span><span>${this.formatCurrency(sale.remaining)}</span></div>` : ''}</div>
<div class="footer"><p>شكراً لتعاملكم معنا - ${settings.storeName || 'Mi Store'}</p></div><script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
        printWindow.document.close();
    }
    
    async cancelSale(id) {
        this.modal.confirm('إلغاء الفاتورة', 'سيتم إعادة الكميات إلى المخزون. هل أنت متأكد؟', async () => {
            const sales = await this.storage.get('sales', []);
            const sale = sales.find(s => s.id === id);
            if (!sale) return;
            const products = await this.storage.get('products', []);
            sale.items.forEach(item => {
                const product = products.find(p => p.id === item.productId);
                if (product) product.quantity += item.quantity;
            });
            await this.storage.set('products', products);
            sale.status = 'cancelled';
            await this.storage.set('sales', sales);
            this.toast.success('تم', 'تم إلغاء الفاتورة');
            await this.renderSalesTable();
            await this.renderInventoryTable();
            await this.renderProductsTable();
            await this.updateStats();
        });
    }
    
    // ===== المشتريات =====
    async renderPurchasesTable() {
        const purchases = await this.storage.get('purchases', []);
        const tbody = document.getElementById('purchasesTableBody');
        if (!tbody) return;
        if (purchases.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-truck-loading"></i><p>لا توجد مشتريات</p></div></td></tr>';
            return;
        }
        const suppliers = await this.storage.get('suppliers', []);
        tbody.innerHTML = purchases.slice().reverse().map(p => {
            const supplier = suppliers.find(s => s.id === p.supplierId);
            return `
                <tr>
                    <td><strong>${p.invoiceNumber}</strong></td>
                    <td>${this.formatDateTime(p.date)}</td>
                    <td>${supplier?.name || '-'}</td>
                    <td><strong>${this.formatCurrency(p.total)}</strong></td>
                    <td><span class="status-badge ${p.status === 'paid' ? 'success' : p.status === 'pending' ? 'warning' : 'danger'}">${p.status === 'paid' ? 'مدفوعة' : p.status === 'pending' ? 'معلقة' : 'ملغاة'}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn view" onclick="app.viewPurchase(${p.id})"><i class="fas fa-eye"></i></button>
                            <button class="action-btn print" onclick="app.printPurchase(${p.id})"><i class="fas fa-print"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    async showNewPurchaseModal() {
        this.cart = [];
        const suppliers = await this.storage.get('suppliers', []);
        const products = await this.storage.get('products', []);
        if (suppliers.length === 0) { this.toast.warning('تنبيه', 'أضف مورداً أولاً'); return; }
        const body = `
            <div class="form-group"><label>المورد *</label>
                <select class="form-select" id="purchaseSupplier" required>
                    <option value="">-- اختر مورد --</option>
                    ${suppliers.map(s => `<option value="${s.id}">${s.name} - ${s.phone}</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>إضافة منتج</label>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <select class="form-select" id="purchaseProductSelect" style="flex:2;min-width:200px">
                        <option value="">-- اختر منتج --</option>
                        ${products.map(p => `<option value="${p.id}" data-code="${p.code}" data-name="${p.name}" data-price="${p.purchasePrice}">${p.code} - ${p.name}</option>`).join('')}
                        <option value="__new__">+ منتج جديد</option>
                    </select>
                    <input type="number" class="form-input" id="purchaseProductQty" value="1" min="1" style="flex:1" placeholder="الكمية">
                    <input type="number" class="form-input" id="purchaseProductPrice" value="0" min="0" style="flex:1" placeholder="السعر">
                    <button type="button" class="btn btn-primary" onclick="app.addToPurchaseCart()"><i class="fas fa-plus"></i></button>
                </div>
            </div>
            <div id="newProductFields" style="display:none;background:#f8f9fa;padding:12px;border-radius:8px;margin-bottom:12px">
                <div class="form-row">
                    <div class="form-group"><label>كود المنتج الجديد</label><input type="text" class="form-input" id="newProductCode"></div>
                    <div class="form-group"><label>اسم المنتج الجديد</label><input type="text" class="form-input" id="newProductName"></div>
                </div>
            </div>
            <div class="invoice-cart" id="purchaseCart"><div class="empty-state"><i class="fas fa-shopping-basket"></i><p>السلة فارغة</p></div></div>
            <div class="invoice-totals">
                <div class="total-row"><span>المجموع:</span><span id="purchaseSubtotal">0 د.ع</span></div>
                <div class="total-row grand-total"><span>الإجمالي:</span><span id="purchaseTotal">0 د.ع</span></div>
            </div>
            <div class="form-row mt-2">
                <div class="form-group"><label>طريقة الدفع</label>
                    <select class="form-select" id="purchasePayment">
                        <option value="cash">نقدي</option><option value="credit">آجل</option><option value="partial">جزئي</option>
                    </select>
                </div>
                <div class="form-group"><label>المبلغ المدفوع</label><input type="number" class="form-input" id="purchasePaid" value="0" min="0"></div>
            </div>
            <div class="form-group"><label>ملاحظات</label><textarea class="form-textarea" id="purchaseNotes" style="min-height:60px"></textarea></div>
        `;
        const footer = `
            <button class="btn btn-outline" onclick="app.modal.close()">إلغاء</button>
            <button class="btn btn-success" onclick="app.savePurchase()"><i class="fas fa-check"></i> حفظ فاتورة الشراء</button>
        `;
        this.modal.open('فاتورة شراء جديدة', body, footer);
        document.getElementById('purchaseProductSelect').addEventListener('change', (e) => {
            const val = e.target.value;
            const newFields = document.getElementById('newProductFields');
            if (val === '__new__') { newFields.style.display = 'block'; }
            else {
                newFields.style.display = 'none';
                const option = e.target.options[e.target.selectedIndex];
                if (option?.dataset.price) document.getElementById('purchaseProductPrice').value = option.dataset.price;
            }
        });
    }
    
    addToPurchaseCart() {
        const select = document.getElementById('purchaseProductSelect');
        const qty = parseInt(document.getElementById('purchaseProductQty').value);
        const price = parseFloat(document.getElementById('purchaseProductPrice').value);
        if (!select.value) { this.toast.warning('تنبيه', 'اختر منتج'); return; }
        if (!qty || qty <= 0 || isNaN(price) || price < 0) { this.toast.warning('تنبيه', 'بيانات غير صحيحة'); return; }
        
        let productId, productName, productCode, isNew = false;
        if (select.value === '__new__') {
            productCode = document.getElementById('newProductCode').value.trim();
            productName = document.getElementById('newProductName').value.trim();
            if (!productCode || !productName) { this.toast.warning('تنبيه', 'أدخل كود واسم المنتج'); return; }
            productId = 'new_' + Date.now();
            isNew = true;
        } else {
            productId = parseInt(select.value);
            const option = select.options[select.selectedIndex];
            productName = option.dataset.name;
            productCode = option.dataset.code;
        }
        
        const existing = this.cart.find(item => item.productId === productId);
        if (existing) { existing.quantity += qty; existing.total = existing.quantity * existing.price; }
        else this.cart.push({ productId, productName, productCode, price, quantity: qty, total: qty * price, isNew });
        
        this.renderPurchaseCart();
        select.value = '';
        document.getElementById('purchaseProductQty').value = 1;
        document.getElementById('purchaseProductPrice').value = 0;
    }
    
    renderPurchaseCart() {
        const container = document.getElementById('purchaseCart');
        if (!container) return;
        if (this.cart.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-shopping-basket"></i><p>السلة فارغة</p></div>';
            this.updatePurchaseTotals();
            return;
        }
        container.innerHTML = this.cart.map((item, idx) => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.productCode} - ${item.productName} ${item.isNew ? '<span style="color:#FF6700">(جديد)</span>' : ''}</div>
                    <div class="cart-item-price">${this.formatCurrency(item.price)} × ${item.quantity}</div>
                </div>
                <div class="cart-item-total">${this.formatCurrency(item.total)}</div>
                <button class="action-btn delete" onclick="app.removeFromPurchaseCart(${idx})"><i class="fas fa-trash"></i></button>
            </div>
        `).join('');
        this.updatePurchaseTotals();
    }
    
    removeFromPurchaseCart(idx) { this.cart.splice(idx, 1); this.renderPurchaseCart(); }
    
    updatePurchaseTotals() {
        const total = this.cart.reduce((sum, item) => sum + item.total, 0);
        const subtotalEl = document.getElementById('purchaseSubtotal');
        const totalEl = document.getElementById('purchaseTotal');
        if (subtotalEl) subtotalEl.textContent = this.formatCurrency(total);
        if (totalEl) totalEl.textContent = this.formatCurrency(total);
    }
    
    async savePurchase() {
        if (this.cart.length === 0) { this.toast.warning('تنبيه', 'السلة فارغة!'); return; }
        const supplierId = parseInt(document.getElementById('purchaseSupplier').value);
        if (!supplierId) { this.toast.error('خطأ', 'اختر المورد'); return; }
        
        const suppliers = await this.storage.get('suppliers', []);
        const supplier = suppliers.find(s => s.id === supplierId);
        const total = this.cart.reduce((sum, item) => sum + item.total, 0);
        const paymentMethod = document.getElementById('purchasePayment').value;
        const paid = parseFloat(document.getElementById('purchasePaid').value) || 0;
        const notes = document.getElementById('purchaseNotes').value.trim();
        
        let status = 'paid';
        if (paymentMethod === 'credit') status = 'pending';
        else if (paid < total) status = 'pending';
        
        const purchases = await this.storage.get('purchases', []);
        const purchase = {
            id: purchases.length > 0 ? Math.max(...purchases.map(p => p.id)) + 1 : 1,
            invoiceNumber: this.generateInvoiceNumber('PUR'),
            date: new Date().toISOString(), supplierId, supplierName: supplier.name,
            items: this.cart.map(item => ({ ...item })), total, paid, remaining: Math.max(0, total - paid),
            paymentMethod, notes, status, user: this.auth.getCurrentUser()?.fullName || 'admin'
        };
        purchases.push(purchase);
        await this.storage.set('purchases', purchases);
        
        const products = await this.storage.get('products', []);
        const movements = await this.storage.get('stockMovements', []);
        
        for (const item of this.cart) {
            if (item.isNew) {
                const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
                products.push({ id: newId, code: item.productCode, name: item.productName, category: 'accessories', purchasePrice: item.price, salePrice: Math.round(item.price * 1.3), quantity: item.quantity, minQuantity: 5, description: '', createdAt: new Date().toISOString() });
                movements.push({ id: movements.length + 1, productId: newId, productName: item.productName, type: 'purchase', quantity: item.quantity, price: item.price, reference: purchase.invoiceNumber, date: purchase.date, user: purchase.user });
            } else {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    product.quantity += item.quantity;
                    product.purchasePrice = item.price;
                    movements.push({ id: movements.length + 1, productId: product.id, productName: product.name, type: 'purchase', quantity: item.quantity, price: item.price, reference: purchase.invoiceNumber, date: purchase.date, user: purchase.user });
                }
            }
        }
        
        await this.storage.set('products', products);
        await this.storage.set('stockMovements', movements);
        
        if (purchase.remaining > 0) {
            supplier.balance = (supplier.balance || 0) + purchase.remaining;
            await this.storage.set('suppliers', suppliers);
        }
        
        this.modal.close();
        this.toast.success('تم', `تم حفظ فاتورة الشراء ${purchase.invoiceNumber}`);
        this.cart = [];
        await this.renderPurchasesTable();
        await this.renderProductsTable();
        await this.renderInventoryTable();
        await this.updateStats();
    }
    
    async viewPurchase(id) {
        const purchases = await this.storage.get('purchases', []);
        const purchase = purchases.find(p => p.id === id);
        if (!purchase) return;
        const body = `
            <div class="print-invoice">
                <div class="print-header"><h1>Mi Store</h1><p>فاتورة شراء</p></div>
                <div class="print-info">
                    <div class="print-info-block"><h4>رقم الفاتورة</h4><p>${purchase.invoiceNumber}</p></div>
                    <div class="print-info-block"><h4>التاريخ</h4><p>${this.formatDateTime(purchase.date)}</p></div>
                    <div class="print-info-block"><h4>المورد</h4><p>${purchase.supplierName}</p></div>
                    <div class="print-info-block"><h4>الحالة</h4><p>${purchase.status === 'paid' ? 'مدفوعة' : 'معلقة'}</p></div>
                </div>
                <table class="print-table">
                    <thead><tr><th>الكود</th><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
                    <tbody>${purchase.items.map(item => `<tr><td>${item.productCode}</td><td>${item.productName}</td><td>${item.quantity}</td><td>${this.formatCurrency(item.price)}</td><td>${this.formatCurrency(item.total)}</td></tr>`).join('')}</tbody>
                </table>
                <div class="print-totals">
                    <div class="total-row grand-total"><span>الإجمالي:</span><span>${this.formatCurrency(purchase.total)}</span></div>
                    <div class="total-row"><span>المدفوع:</span><span>${this.formatCurrency(purchase.paid)}</span></div>
                    ${purchase.remaining > 0 ? `<div class="total-row text-danger"><span>المتبقي:</span><span>${this.formatCurrency(purchase.remaining)}</span></div>` : ''}
                </div>
            </div>
        `;
        const footer = `
            <button class="btn btn-outline" onclick="app.modal.close()">إغلاق</button>
            <button class="btn btn-primary" onclick="app.printPurchase(${purchase.id})"><i class="fas fa-print"></i> طباعة</button>
        `;
        this.modal.open(`فاتورة ${purchase.invoiceNumber}`, body, footer);
    }
    
    async printPurchase(id) {
        const purchases = await this.storage.get('purchases', []);
        const p = purchases.find(x => x.id === id);
        if (!p) return;
        const settings = await this.storage.get('settings', {});
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        printWindow.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>فاتورة شراء ${p.invoiceNumber}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Tahoma,Arial;padding:20px}
.header{text-align:center;border-bottom:3px solid #FF6700;padding-bottom:15px;margin-bottom:20px}.header h1{color:#FF6700;font-size:32px}
.info{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px}
.info-block{background:#f8f9fa;padding:10px;border-radius:6px}.info-block h4{font-size:12px;color:#6c757d;margin-bottom:3px}.info-block p{font-size:14px;font-weight:600}
table{width:100%;border-collapse:collapse;margin-bottom:20px}th{background:#FF6700;color:white;padding:10px;text-align:right}td{padding:10px;border-bottom:1px solid #dee2e6}
.totals{margin-right:auto;width:300px}.totals .row{display:flex;justify-content:space-between;padding:5px 0}.totals .grand{font-size:18px;font-weight:800;color:#FF6700;border-top:2px solid #FF6700;padding-top:8px;margin-top:8px}
.footer{margin-top:40px;text-align:center;color:#6c757d;font-size:12px}</style></head>
<body><div class="header"><h1>${settings.storeName || 'Mi Store'}</h1><p>فاتورة شراء</p></div>
<div class="info"><div class="info-block"><h4>رقم الفاتورة</h4><p>${p.invoiceNumber}</p></div><div class="info-block"><h4>التاريخ</h4><p>${this.formatDateTime(p.date)}</p></div><div class="info-block"><h4>المورد</h4><p>${p.supplierName}</p></div><div class="info-block"><h4>طريقة الدفع</h4><p>${p.paymentMethod === 'cash' ? 'نقدي' : p.paymentMethod === 'credit' ? 'آجل' : 'جزئي'}</p></div></div>
<table><thead><tr><th>#</th><th>الكود</th><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${p.items.map((item, i) => `<tr><td>${i + 1}</td><td>${item.productCode}</td><td>${item.productName}</td><td>${item.quantity}</td><td>${this.formatCurrency(item.price)}</td><td>${this.formatCurrency(item.total)}</td></tr>`).join('')}</tbody></table>
<div class="totals"><div class="row grand"><span>الإجمالي:</span><span>${this.formatCurrency(p.total)}</span></div><div class="row"><span>المدفوع:</span><span>${this.formatCurrency(p.paid)}</span></div>${p.remaining > 0 ? `<div class="row" style="color:#E74C3C"><span>المتبقي:</span><span>${this.formatCurrency(p.remaining)}</span></div>` : ''}</div>
<div class="footer"><p>${settings.storeName || 'Mi Store'}</p></div><script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
        printWindow.document.close();
    }
        // ===== أدوات مساعدة =====
    formatCurrency(amount) {
        return new Intl.NumberFormat('ar-IQ').format(amount || 0) + ' د.ع';
    }
    
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    
    formatDateTime(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    
    async generateInvoiceNumber(prefix = 'INV') {
        const year = new Date().getFullYear();
        const sales = await this.storage.get('sales', []);
        const purchases = await this.storage.get('purchases', []);
        const all = [...sales, ...purchases];
        const lastNum = all.length > 0 ? Math.max(...all.map(i => {
            const match = i.invoiceNumber?.match(/-(\d+)$/);
            return match ? parseInt(match[1]) : 0;
        })) : 0;
        return `${prefix}-${year}-${String(lastNum + 1).padStart(4, '0')}`;
    }
    
    async saveSettings() {
        const settings = {
            storeName: document.getElementById('storeName').value,
            storeAddress: document.getElementById('storeAddress').value,
            storePhone: document.getElementById('storePhone').value,
            currency: document.getElementById('currency').value,
            taxRate: parseFloat(document.getElementById('taxRate').value) || 0
        };
        await this.storage.set('settings', settings);
        this.toast.success('تم', 'تم حفظ الإعدادات');
    }
    
    async loadSettings() {
        const settings = await this.storage.get('settings', {});
        document.getElementById('storeName').value = settings.storeName || '';
        document.getElementById('storeAddress').value = settings.storeAddress || '';
        document.getElementById('storePhone').value = settings.storePhone || '';
        document.getElementById('currency').value = settings.currency || 'IQD';
        document.getElementById('taxRate').value = settings.taxRate || 0;
    }
    
    // ===== الموردين =====
    async renderSuppliersTable() {
        const suppliers = await this.storage.get('suppliers', []);
        const tbody = document.getElementById('suppliersTableBody');
        if (!tbody) return;
        if (suppliers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-industry"></i><p>لا يوجد موردين</p></div></td></tr>';
            return;
        }
        tbody.innerHTML = suppliers.map(s => `
            <tr>
                <td><strong>${s.code}</strong></td>
                <td>${s.name}</td>
                <td>${s.phone}</td>
                <td>${s.address || '-'}</td>
                <td><span class="status-badge ${s.balance > 0 ? 'danger' : 'success'}">${this.formatCurrency(s.balance || 0)}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn view" onclick="app.viewSupplier(${s.id})"><i class="fas fa-eye"></i></button>
                        <button class="action-btn edit" onclick="app.editSupplier(${s.id})"><i class="fas fa-edit"></i></button>
                        <button class="action-btn delete" onclick="app.deleteSupplier(${s.id})"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    showAddSupplierModal() { this.openSupplierModal(); }
    
    openSupplierModal(supplier = null) {
        const isEdit = !!supplier;
        const body = `
            <form id="supplierForm">
                <div class="form-row">
                    <div class="form-group"><label>كود المورد *</label><input type="text" class="form-input" id="sCode" value="${supplier?.code || this.generateCode('SUP')}" required></div>
                    <div class="form-group"><label>اسم المورد *</label><input type="text" class="form-input" id="sName" value="${supplier?.name || ''}" required></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>الهاتف *</label><input type="tel" class="form-input" id="sPhone" value="${supplier?.phone || ''}" required></div>
                    <div class="form-group"><label>البريد الإلكتروني</label><input type="email" class="form-input" id="sEmail" value="${supplier?.email || ''}"></div>
                </div>
                <div class="form-group"><label>العنوان</label><input type="text" class="form-input" id="sAddress" value="${supplier?.address || ''}"></div>
                <div class="form-group"><label>الرصيد الافتتاحي</label><input type="number" class="form-input" id="sBalance" value="${supplier?.balance || 0}" min="0"></div>
                <div class="form-group"><label>ملاحظات</label><textarea class="form-textarea" id="sNotes">${supplier?.notes || ''}</textarea></div>
            </form>
        `;
        const footer = `
            <button class="btn btn-outline" onclick="app.modal.close()">إلغاء</button>
            <button class="btn btn-primary" onclick="app.saveSupplier(${supplier?.id || 'null'})"><i class="fas fa-save"></i> ${isEdit ? 'تحديث' : 'حفظ'}</button>
        `;
        this.modal.open(isEdit ? 'تعديل المورد' : 'إضافة مورد جديد', body, footer);
    }
    
    async saveSupplier(id) {
        const code = document.getElementById('sCode').value.trim();
        const name = document.getElementById('sName').value.trim();
        const phone = document.getElementById('sPhone').value.trim();
        const email = document.getElementById('sEmail').value.trim();
        const address = document.getElementById('sAddress').value.trim();
        const balance = parseFloat(document.getElementById('sBalance').value) || 0;
        const notes = document.getElementById('sNotes').value.trim();
        
        if (!code || !name || !phone) { this.toast.error('خطأ', 'يرجى ملء الحقول المطلوبة'); return; }
        
        const suppliers = await this.storage.get('suppliers', []);
        if (id) {
            const index = suppliers.findIndex(s => s.id === id);
            if (index !== -1) {
                suppliers[index] = { ...suppliers[index], code, name, phone, email, address, balance, notes };
                await this.storage.set('suppliers', suppliers);
                this.toast.success('تم', 'تم تحديث المورد');
            }
        } else {
            const newId = suppliers.length > 0 ? Math.max(...suppliers.map(s => s.id)) + 1 : 1;
            suppliers.push({ id: newId, code, name, phone, email, address, balance, notes, createdAt: new Date().toISOString() });
            await this.storage.set('suppliers', suppliers);
            this.toast.success('تم', 'تم إضافة المورد');
        }
        this.modal.close();
        await this.renderSuppliersTable();
    }
    
    async editSupplier(id) {
        const suppliers = await this.storage.get('suppliers', []);
        const supplier = suppliers.find(s => s.id === id);
        if (supplier) this.openSupplierModal(supplier);
    }
    
    async deleteSupplier(id) {
        const purchases = await this.storage.get('purchases', []);
        if (purchases.some(p => p.supplierId === id)) {
            this.toast.error('خطأ', 'لا يمكن حذف المورد لوجود فواتير مرتبطة');
            return;
        }
        this.modal.confirm('حذف المورد', 'هل أنت متأكد؟', async () => {
            let suppliers = await this.storage.get('suppliers', []);
            suppliers = suppliers.filter(s => s.id !== id);
            await this.storage.set('suppliers', suppliers);
            this.toast.success('تم', 'تم حذف المورد');
            await this.renderSuppliersTable();
        });
    }
    
    async viewSupplier(id) {
        const suppliers = await this.storage.get('suppliers', []);
        const supplier = suppliers.find(s => s.id === id);
        if (!supplier) return;
        const purchases = (await this.storage.get('purchases', [])).filter(p => p.supplierId === id);
        const totalPurchases = purchases.reduce((sum, p) => sum + p.total, 0);
        const totalPaid = purchases.reduce((sum, p) => sum + (p.paid || 0), 0);
        const totalRemaining = purchases.reduce((sum, p) => sum + (p.remaining || 0), 0);
        
        const body = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px">
                <div style="background:#f8f9fa;padding:15px;border-radius:8px"><h4 style="color:#6c757d;font-size:12px;margin-bottom:5px">كود المورد</h4><p style="font-weight:700">${supplier.code}</p></div>
                <div style="background:#f8f9fa;padding:15px;border-radius:8px"><h4 style="color:#6c757d;font-size:12px;margin-bottom:5px">الهاتف</h4><p style="font-weight:700">${supplier.phone}</p></div>
                <div style="background:#f8f9fa;padding:15px;border-radius:8px"><h4 style="color:#6c757d;font-size:12px;margin-bottom:5px">العنوان</h4><p style="font-weight:700">${supplier.address || '-'}</p></div>
                <div style="background:#f8f9fa;padding:15px;border-radius:8px"><h4 style="color:#6c757d;font-size:12px;margin-bottom:5px">الرصيد</h4><p style="font-weight:700;color:${supplier.balance > 0 ? '#E74C3C' : '#27AE60'}">${this.formatCurrency(supplier.balance)}</p></div>
            </div>
            <h3 style="margin-bottom:15px;font-size:16px">فواتير الشراء (${purchases.length})</h3>
            ${purchases.length === 0 ? '<div class="empty-state"><i class="fas fa-file-invoice"></i><p>لا توجد فواتير</p></div>' : `
                <div style="max-height:300px;overflow-y:auto">
                    ${purchases.map(p => `<div class="list-item"><div class="list-item-info"><div class="list-item-title">${p.invoiceNumber}</div><div class="list-item-subtitle">${this.formatDateTime(p.date)}</div></div><div class="list-item-value">${this.formatCurrency(p.total)}</div></div>`).join('')}
                </div>
                <div style="margin-top:20px;padding:15px;background:#fff3e0;border-radius:8px">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span>إجمالي المشتريات:</span><strong>${this.formatCurrency(totalPurchases)}</strong></div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span>إجمالي المدفوع:</span><strong style="color:#27AE60">${this.formatCurrency(totalPaid)}</strong></div>
                    <div style="display:flex;justify-content:space-between;border-top:2px solid #FF6700;padding-top:8px;margin-top:8px"><span>المتبقي:</span><strong style="color:#E74C3C;font-size:18px">${this.formatCurrency(totalRemaining)}</strong></div>
                </div>
            `}
        `;
        const footer = `
            <button class="btn btn-outline" onclick="app.modal.close()">إغلاق</button>
            <button class="btn btn-primary" onclick="app.editSupplier(${supplier.id})"><i class="fas fa-edit"></i> تعديل</button>
        `;
        this.modal.open(`بيانات المورد: ${supplier.name}`, body, footer);
    }
    
    // ===== العملاء =====
    async renderCustomersTable() {
        const customers = await this.storage.get('customers', []);
        const tbody = document.getElementById('customersTableBody');
        if (!tbody) return;
        if (customers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-users"></i><p>لا يوجد عملاء</p></div></td></tr>';
            return;
        }
        tbody.innerHTML = customers.map(c => `
            <tr>
                <td><strong>${c.code}</strong></td>
                <td>${c.name}</td>
                <td>${c.phone}</td>
                <td>${c.address || '-'}</td>
                <td><span class="status-badge ${c.balance > 0 ? 'danger' : 'success'}">${this.formatCurrency(c.balance || 0)}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn view" onclick="app.viewCustomer(${c.id})"><i class="fas fa-eye"></i></button>
                        <button class="action-btn edit" onclick="app.editCustomer(${c.id})"><i class="fas fa-edit"></i></button>
                        <button class="action-btn delete" onclick="app.deleteCustomer(${c.id})"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    showAddCustomerModal() { this.openCustomerModal(); }
    
    openCustomerModal(customer = null) {
        const isEdit = !!customer;
        const body = `
            <form id="customerForm">
                <div class="form-row">
                    <div class="form-group"><label>كود العميل *</label><input type="text" class="form-input" id="cCode" value="${customer?.code || this.generateCode('CUS')}" required></div>
                    <div class="form-group"><label>اسم العميل *</label><input type="text" class="form-input" id="cName" value="${customer?.name || ''}" required></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>الهاتف *</label><input type="tel" class="form-input" id="cPhone" value="${customer?.phone || ''}" required></div>
                    <div class="form-group"><label>البريد الإلكتروني</label><input type="email" class="form-input" id="cEmail" value="${customer?.email || ''}"></div>
                </div>
                <div class="form-group"><label>العنوان</label><input type="text" class="form-input" id="cAddress" value="${customer?.address || ''}"></div>
                <div class="form-group"><label>الرصيد الافتتاحي</label><input type="number" class="form-input" id="cBalance" value="${customer?.balance || 0}" min="0"></div>
                <div class="form-group"><label>ملاحظات</label><textarea class="form-textarea" id="cNotes">${customer?.notes || ''}</textarea></div>
            </form>
        `;
        const footer = `
            <button class="btn btn-outline" onclick="app.modal.close()">إلغاء</button>
            <button class="btn btn-primary" onclick="app.saveCustomer(${customer?.id || 'null'})"><i class="fas fa-save"></i> ${isEdit ? 'تحديث' : 'حفظ'}</button>
        `;
        this.modal.open(isEdit ? 'تعديل العميل' : 'إضافة عميل جديد', body, footer);
    }
    
    async saveCustomer(id) {
        const code = document.getElementById('cCode').value.trim();
        const name = document.getElementById('cName').value.trim();
        const phone = document.getElementById('cPhone').value.trim();
        const email = document.getElementById('cEmail').value.trim();
        const address = document.getElementById('cAddress').value.trim();
        const balance = parseFloat(document.getElementById('cBalance').value) || 0;
        const notes = document.getElementById('cNotes').value.trim();
        
        if (!code || !name || !phone) { this.toast.error('خطأ', 'يرجى ملء الحقول المطلوبة'); return; }
        
        const customers = await this.storage.get('customers', []);
        if (id) {
            const index = customers.findIndex(c => c.id === id);
            if (index !== -1) {
                customers[index] = { ...customers[index], code, name, phone, email, address, balance, notes };
                await this.storage.set('customers', customers);
                this.toast.success('تم', 'تم تحديث العميل');
            }
        } else {
            const newId = customers.length > 0 ? Math.max(...customers.map(c => c.id)) + 1 : 1;
            customers.push({ id: newId, code, name, phone, email, address, balance, notes, createdAt: new Date().toISOString() });
            await this.storage.set('customers', customers);
            this.toast.success('تم', 'تم إضافة العميل');
        }
        this.modal.close();
        await this.renderCustomersTable();
    }
    
    async editCustomer(id) {
        const customers = await this.storage.get('customers', []);
        const customer = customers.find(c => c.id === id);
        if (customer) this.openCustomerModal(customer);
    }
    
    async deleteCustomer(id) {
        const sales = await this.storage.get('sales', []);
        if (sales.some(s => s.customerId === id)) {
            this.toast.error('خطأ', 'لا يمكن حذف العميل لوجود فواتير مرتبطة');
            return;
        }
        this.modal.confirm('حذف العميل', 'هل أنت متأكد؟', async () => {
            let customers = await this.storage.get('customers', []);
            customers = customers.filter(c => c.id !== id);
            await this.storage.set('customers', customers);
            this.toast.success('تم', 'تم حذف العميل');
            await this.renderCustomersTable();
        });
    }
    
    async viewCustomer(id) {
        const customers = await this.storage.get('customers', []);
        const customer = customers.find(c => c.id === id);
        if (!customer) return;
        const sales = (await this.storage.get('sales', [])).filter(s => s.customerId === id);
        const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
        const totalPaid = sales.reduce((sum, s) => sum + (s.paid || 0), 0);
        const totalRemaining = sales.reduce((sum, s) => sum + (s.remaining || 0), 0);
        
        const body = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px">
                <div style="background:#f8f9fa;padding:15px;border-radius:8px"><h4 style="color:#6c757d;font-size:12px;margin-bottom:5px">كود العميل</h4><p style="font-weight:700">${customer.code}</p></div>
                <div style="background:#f8f9fa;padding:15px;border-radius:8px"><h4 style="color:#6c757d;font-size:12px;margin-bottom:5px">الهاتف</h4><p style="font-weight:700">${customer.phone}</p></div>
                <div style="background:#f8f9fa;padding:15px;border-radius:8px"><h4 style="color:#6c757d;font-size:12px;margin-bottom:5px">العنوان</h4><p style="font-weight:700">${customer.address || '-'}</p></div>
                <div style="background:#f8f9fa;padding:15px;border-radius:8px"><h4 style="color:#6c757d;font-size:12px;margin-bottom:5px">الرصيد</h4><p style="font-weight:700;color:${customer.balance > 0 ? '#E74C3C' : '#27AE60'}">${this.formatCurrency(customer.balance)}</p></div>
            </div>
            <h3 style="margin-bottom:15px;font-size:16px">فواتير المبيعات (${sales.length})</h3>
            ${sales.length === 0 ? '<div class="empty-state"><i class="fas fa-file-invoice"></i><p>لا توجد فواتير</p></div>' : `
                <div style="max-height:300px;overflow-y:auto">
                    ${sales.map(s => `<div class="list-item"><div class="list-item-info"><div class="list-item-title">${s.invoiceNumber}</div><div class="list-item-subtitle">${this.formatDateTime(s.date)}</div></div><div class="list-item-value">${this.formatCurrency(s.total)}</div></div>`).join('')}
                </div>
                <div style="margin-top:20px;padding:15px;background:#e3f2fd;border-radius:8px">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span>إجمالي المشتريات:</span><strong>${this.formatCurrency(totalSales)}</strong></div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span>إجمالي المدفوع:</span><strong style="color:#27AE60">${this.formatCurrency(totalPaid)}</strong></div>
                    <div style="display:flex;justify-content:space-between;border-top:2px solid #3498DB;padding-top:8px;margin-top:8px"><span>المتبقي:</span><strong style="color:#E74C3C;font-size:18px">${this.formatCurrency(totalRemaining)}</strong></div>
                </div>
            `}
        `;
        const footer = `
            <button class="btn btn-outline" onclick="app.modal.close()">إغلاق</button>
            <button class="btn btn-primary" onclick="app.editCustomer(${customer.id})"><i class="fas fa-edit"></i> تعديل</button>
        `;
        this.modal.open(`بيانات العميل: ${customer.name}`, body, footer);
    }
    
    // ===== أكواد الخصم =====
    async renderDiscountsTable() {
        const discounts = await this.storage.get('discounts', []);
        const tbody = document.getElementById('discountsTableBody');
        if (!tbody) return;
        if (discounts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-ticket-alt"></i><p>لا توجد أكواد خصم</p></div></td></tr>';
            return;
        }
        tbody.innerHTML = discounts.map(d => {
            const isExpired = new Date(d.expiryDate) < new Date();
            const isMaxUsed = d.usedCount >= d.maxUses;
            let status, statusClass;
            if (!d.active) { status = 'معطل'; statusClass = 'info'; }
            else if (isExpired) { status = 'منتهي'; statusClass = 'danger'; }
            else if (isMaxUsed) { status = 'مستخدم بالكامل'; statusClass = 'warning'; }
            else { status = 'نشط'; statusClass = 'success'; }
            return `
                <tr>
                    <td><strong style="font-family:monospace;font-size:16px;color:var(--primary)">${d.code}</strong></td>
                    <td><span class="status-badge warning">${d.discount}%</span></td>
                    <td>${d.maxUses}</td>
                    <td>${d.usedCount}</td>
                    <td>${this.formatDate(d.expiryDate)}</td>
                    <td><span class="status-badge ${statusClass}">${status}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn copy" onclick="app.copyDiscountCode('${d.code}')" title="نسخ"><i class="fas fa-copy"></i></button>
                            <button class="action-btn edit" onclick="app.editDiscount(${d.id})" title="تعديل"><i class="fas fa-edit"></i></button>
                            <button class="action-btn ${d.active ? 'delete' : 'view'}" onclick="app.toggleDiscount(${d.id})" title="${d.active ? 'تعطيل' : 'تفعيل'}"><i class="fas fa-${d.active ? 'ban' : 'check'}"></i></button>
                            <button class="action-btn delete" onclick="app.deleteDiscount(${d.id})" title="حذف"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    showAddDiscountModal() { this.openDiscountModal(); }
    
    openDiscountModal(discount = null) {
        const isEdit = !!discount;
        const body = `
            <form id="discountForm">
                <div class="form-group">
                    <label>كود الخصم *</label>
                    <input type="text" class="form-input" id="dCode" value="${discount?.code || ''}" placeholder="مثال: SUMMER20" style="font-family:monospace;font-size:18px;text-transform:uppercase" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>نسبة الخصم (%) *</label>
                        <input type="number" class="form-input" id="dDiscount" value="${discount?.discount || ''}" min="1" max="100" required>
                    </div>
                    <div class="form-group">
                        <label>الحد الأقصى للاستخدامات *</label>
                        <input type="number" class="form-input" id="dMaxUses" value="${discount?.maxUses || 100}" min="1" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>تاريخ الانتهاء *</label>
                    <input type="date" class="form-input" id="dExpiry" value="${discount?.expiryDate || ''}" required>
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="dActive" ${discount?.active !== false ? 'checked' : ''}>
                        <span>نشط (مفعل)</span>
                    </label>
                </div>
            </form>
        `;
        const footer = `
            <button class="btn btn-outline" onclick="app.modal.close()">إلغاء</button>
            <button class="btn btn-primary" onclick="app.saveDiscount(${discount?.id || 'null'})"><i class="fas fa-save"></i> ${isEdit ? 'تحديث' : 'إنشاء'}</button>
        `;
        this.modal.open(isEdit ? 'تعديل كود الخصم' : 'إنشاء كود خصم جديد', body, footer);
    }
    
    async saveDiscount(id) {
        const code = document.getElementById('dCode').value.trim().toUpperCase();
        const discount = parseFloat(document.getElementById('dDiscount').value);
        const maxUses = parseInt(document.getElementById('dMaxUses').value);
        const expiryDate = document.getElementById('dExpiry').value;
        const active = document.getElementById('dActive').checked;
        
        if (!code || isNaN(discount) || isNaN(maxUses) || !expiryDate) {
            this.toast.error('خطأ', 'يرجى ملء جميع الحقول');
            return;
        }
        
        if (discount < 1 || discount > 100) {
            this.toast.error('خطأ', 'نسبة الخصم يجب أن تكون بين 1 و 100');
            return;
        }
        
        const discounts = await this.storage.get('discounts', []);
        const exists = discounts.find(d => d.code === code && d.id !== id);
        if (exists) {
            this.toast.error('خطأ', 'هذا الكود موجود مسبقاً');
            return;
        }
        
        if (id) {
            const index = discounts.findIndex(d => d.id === id);
            if (index !== -1) {
                discounts[index] = { ...discounts[index], code, discount, maxUses, expiryDate, active };
                await this.storage.set('discounts', discounts);
                this.toast.success('تم', 'تم تحديث كود الخصم');
            }
        } else {
            const newId = discounts.length > 0 ? Math.max(...discounts.map(d => d.id)) + 1 : 1;
            discounts.push({ id: newId, code, discount, maxUses, usedCount: 0, expiryDate, active, createdAt: new Date().toISOString() });
            await this.storage.set('discounts', discounts);
            this.toast.success('تم', `تم إنشاء كود الخصم: ${code}`);
        }
        this.modal.close();
        await this.renderDiscountsTable();
    }
    
    async editDiscount(id) {
        const discounts = await this.storage.get('discounts', []);
        const discount = discounts.find(d => d.id === id);
        if (discount) this.openDiscountModal(discount);
    }
    
    async toggleDiscount(id) {
        const discounts = await this.storage.get('discounts', []);
        const discount = discounts.find(d => d.id === id);
        if (discount) {
            discount.active = !discount.active;
            await this.storage.set('discounts', discounts);
            this.toast.success('تم', `تم ${discount.active ? 'تفعيل' : 'تعطيل'} الكود`);
            await this.renderDiscountsTable();
        }
    }
    
    async deleteDiscount(id) {
        this.modal.confirm('حذف كود الخصم', 'هل أنت متأكد؟', async () => {
            let discounts = await this.storage.get('discounts', []);
            discounts = discounts.filter(d => d.id !== id);
            await this.storage.set('discounts', discounts);
            this.toast.success('تم', 'تم حذف كود الخصم');
            await this.renderDiscountsTable();
        });
    }
    
    copyDiscountCode(code) {
        navigator.clipboard.writeText(code).then(() => {
            this.toast.success('تم النسخ', `تم نسخ الكود: ${code}`);
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = code;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.toast.success('تم النسخ', `تم نسخ الكود: ${code}`);
        });
    }
    
    // ===== عروض اليوم =====
    async loadOfferSettings() {
        const offers = await this.storage.get('offers', { title: '', startTime: '', endTime: '', products: [] });
        document.getElementById('offerTitle').value = offers.title || '';
        document.getElementById('offerStart').value = offers.startTime ? new Date(offers.startTime).toISOString().slice(0, 16) : '';
        document.getElementById('offerEnd').value = offers.endTime ? new Date(offers.endTime).toISOString().slice(0, 16) : '';
    }
    
    async saveOfferSettings() {
        const title = document.getElementById('offerTitle').value.trim();
        const startTime = document.getElementById('offerStart').value;
        const endTime = document.getElementById('offerEnd').value;
        
        if (!title || !startTime || !endTime) {
            this.toast.error('خطأ', 'يرجى ملء جميع الحقول');
            return;
        }
        
        const offers = await this.storage.get('offers', { title: '', startTime: '', endTime: '', products: [] });
        offers.title = title;
        offers.startTime = new Date(startTime).toISOString();
        offers.endTime = new Date(endTime).toISOString();
        await this.storage.set('offers', offers);
        this.toast.success('تم', 'تم حفظ إعدادات العروض');
    }
    
    async renderOffersTable() {
        const offers = await this.storage.get('offers', { products: [] });
        const products = await this.storage.get('products', []);
        const tbody = document.getElementById('offersTableBody');
        if (!tbody) return;
        if (offers.products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fas fa-fire"></i><p>لا توجد منتجات في العروض</p></div></td></tr>';
            return;
        }
        tbody.innerHTML = offers.products.map(op => {
            const product = products.find(p => p.id === op.productId);
            if (!product) return '';
            const discountedPrice = product.salePrice * (1 - op.discount / 100);
            return `
                <tr>
                    <td><strong>${product.name}</strong><br><small style="color:var(--text-muted)">${product.code}</small></td>
                    <td>${this.formatCurrency(product.salePrice)}</td>
                    <td><span class="status-badge warning">${op.discount}%</span></td>
                    <td><strong style="color:var(--danger)">${this.formatCurrency(discountedPrice)}</strong></td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn edit" onclick="app.editOfferProduct(${product.id})" title="تعديل الخصم"><i class="fas fa-edit"></i></button>
                            <button class="action-btn delete" onclick="app.removeOfferProduct(${product.id})" title="إزالة"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    async showAddOfferModal() {
        const products = await this.storage.get('products', []);
        const offers = await this.storage.get('offers', { products: [] });
        const availableProducts = products.filter(p => !offers.products.find(op => op.productId === p.id));
        
        if (availableProducts.length === 0) {
            this.toast.warning('تنبيه', 'جميع المنتجات موجودة في العروض أو لا توجد منتجات');
            return;
        }
        
        const body = `
            <div class="form-group">
                <label>اختر المنتج *</label>
                <select class="form-select" id="offerProductSelect" required>
                    <option value="">-- اختر منتج --</option>
                    ${availableProducts.map(p => `<option value="${p.id}">${p.code} - ${p.name} (${this.formatCurrency(p.salePrice)})</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>نسبة الخصم (%) *</label>
                <input type="number" class="form-input" id="offerDiscount" min="1" max="90" value="10" required>
            </div>
            <div style="background:#fff3e0;padding:15px;border-radius:8px;margin-top:15px">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                    <span>السعر الأصلي:</span>
                    <strong id="offerOriginalPrice">-</strong>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:18px">
                    <span>السعر بعد الخصم:</span>
                    <strong style="color:var(--danger)" id="offerFinalPrice">-</strong>
                </div>
            </div>
        `;
        const footer = `
            <button class="btn btn-outline" onclick="app.modal.close()">إلغاء</button>
            <button class="btn btn-primary" onclick="app.saveOfferProduct()"><i class="fas fa-plus"></i> إضافة للعروض</button>
        `;
        this.modal.open('إضافة منتج للعروض', body, footer);
        
        document.getElementById('offerProductSelect').addEventListener('change', (e) => {
            const product = products.find(p => p.id === parseInt(e.target.value));
            const discount = parseFloat(document.getElementById('offerDiscount').value) || 0;
            if (product) {
                document.getElementById('offerOriginalPrice').textContent = this.formatCurrency(product.salePrice);
                document.getElementById('offerFinalPrice').textContent = this.formatCurrency(product.salePrice * (1 - discount / 100));
            }
        });
        
        document.getElementById('offerDiscount').addEventListener('input', (e) => {
            const productId = parseInt(document.getElementById('offerProductSelect').value);
            const product = products.find(p => p.id === productId);
            const discount = parseFloat(e.target.value) || 0;
            if (product) {
                document.getElementById('offerFinalPrice').textContent = this.formatCurrency(product.salePrice * (1 - discount / 100));
            }
        });
    }
    
    async saveOfferProduct() {
        const productId = parseInt(document.getElementById('offerProductSelect').value);
        const discount = parseFloat(document.getElementById('offerDiscount').value);
        
        if (!productId || isNaN(discount) || discount < 1 || discount > 90) {
            this.toast.error('خطأ', 'بيانات غير صحيحة');
            return;
        }
        
        const offers = await this.storage.get('offers', { title: '', startTime: '', endTime: '', products: [] });
        if (offers.products.find(op => op.productId === productId)) {
            this.toast.error('خطأ', 'هذا المنتج موجود بالفعل في العروض');
            return;
        }
        
        offers.products.push({ productId, discount });
        await this.storage.set('offers', offers);
        this.modal.close();
        this.toast.success('تم', 'تم إضافة المنتج للعروض');
        await this.renderOffersTable();
    }
    
    async editOfferProduct(productId) {
        const offers = await this.storage.get('offers', { products: [] });
        const offer = offers.products.find(op => op.productId === productId);
        if (!offer) return;
        
        const products = await this.storage.get('products', []);
        const product = products.find(p => p.id === productId);
        if (!product) return;
        
        const body = `
            <div style="background:#f8f9fa;padding:15px;border-radius:8px;margin-bottom:20px">
                <h4>${product.name}</h4>
                <p style="color:var(--text-muted)">السعر الأصلي: ${this.formatCurrency(product.salePrice)}</p>
            </div>
            <div class="form-group">
                <label>نسبة الخصم (%)</label>
                <input type="number" class="form-input" id="editOfferDiscount" min="1" max="90" value="${offer.discount}" required>
            </div>
            <div style="background:#fff3e0;padding:15px;border-radius:8px;margin-top:15px">
                <div style="display:flex;justify-content:space-between;font-size:18px">
                    <span>السعر بعد الخصم:</span>
                    <strong style="color:var(--danger)" id="editOfferFinalPrice">${this.formatCurrency(product.salePrice * (1 - offer.discount / 100))}</strong>
                </div>
            </div>
        `;
        const footer = `
            <button class="btn btn-outline" onclick="app.modal.close()">إلغاء</button>
            <button class="btn btn-primary" onclick="app.updateOfferProduct(${productId})"><i class="fas fa-save"></i> حفظ</button>
        `;
        this.modal.open('تعديل خصم العرض', body, footer);
        
        document.getElementById('editOfferDiscount').addEventListener('input', (e) => {
            const discount = parseFloat(e.target.value) || 0;
            document.getElementById('editOfferFinalPrice').textContent = this.formatCurrency(product.salePrice * (1 - discount / 100));
        });
    }
    
    async updateOfferProduct(productId) {
        const discount = parseFloat(document.getElementById('editOfferDiscount').value);
        if (isNaN(discount) || discount < 1 || discount > 90) {
            this.toast.error('خطأ', 'نسبة الخصم غير صحيحة');
            return;
        }
        
        const offers = await this.storage.get('offers', { products: [] });
        const offer = offers.products.find(op => op.productId === productId);
        if (offer) {
            offer.discount = discount;
            await this.storage.set('offers', offers);
            this.modal.close();
            this.toast.success('تم', 'تم تحديث الخصم');
            await this.renderOffersTable();
        }
    }
    
    async removeOfferProduct(productId) {
        this.modal.confirm('إزالة من العروض', 'هل أنت متأكد؟', async () => {
            const offers = await this.storage.get('offers', { products: [] });
            offers.products = offers.products.filter(op => op.productId !== productId);
            await this.storage.set('offers', offers);
            this.toast.success('تم', 'تم إزالة المنتج من العروض');
            await this.renderOffersTable();
        });
    }
    
    // ===== نظام الشات =====
    async renderChatList() {
        const chats = await this.storage.get('chats', []);
        const container = document.getElementById('chatListItems');
        const countEl = document.getElementById('chatCount');
        if (!container) return;
        countEl.textContent = chats.length;
        if (chats.length === 0) {
            container.innerHTML = '<div class="empty-state" style="padding:30px"><i class="fas fa-comments"></i><p>لا توجد محادثات</p></div>';
            return;
        }
        container.innerHTML = chats.slice().reverse().map(c => `
            <div class="chat-list-item ${c.id === this.currentChatId ? 'active' : ''} ${c.unread > 0 ? 'unread' : ''}" onclick="app.openChat(${c.id})">
                <div class="chat-list-avatar">${c.customerName.charAt(0)}</div>
                <div class="chat-list-info">
                    <h4>${c.customerName}</h4>
                    <p>${c.lastMessage.substring(0, 50)}${c.lastMessage.length > 50 ? '...' : ''}</p>
                </div>
                <div class="chat-list-time">${this.formatTimeAgo(c.createdAt)}</div>
            </div>
        `).join('');
    }
    
    async openChat(chatId) {
        const chats = await this.storage.get('chats', []);
        const chat = chats.find(c => c.id === chatId);
        if (!chat) return;
        
        this.currentChatId = chatId;
        
        document.getElementById('chatUserName').textContent = chat.customerName;
        document.getElementById('chatUserStatus').textContent = 'متصل الآن';
        document.getElementById('chatUserAvatar').textContent = chat.customerName.charAt(0);
        document.getElementById('chatInputArea').style.display = 'flex';
        
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.innerHTML = chat.messages.map(msg => `
            <div class="chat-message ${msg.from}">
                ${msg.text}
                <span class="time">${this.formatTime(msg.time)}</span>
            </div>
        `).join('');
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        if (chat.unread > 0) {
            chat.unread = 0;
            await this.storage.set('chats', chats);
            await this.renderChatList();
            await this.updateChatBadge();
        }
        
        document.querySelectorAll('.chat-list-item').forEach(item => item.classList.remove('active'));
        const activeItem = document.querySelector(`.chat-list-item[onclick="app.openChat(${chatId})"]`);
        if (activeItem) activeItem.classList.add('active');
    }
    
    async sendReply() {
        if (!this.currentChatId) return;
        const input = document.getElementById('chatReplyInput');
        const text = input.value.trim();
        if (!text) return;
        
        const chats = await this.storage.get('chats', []);
        const chat = chats.find(c => c.id === this.currentChatId);
        if (!chat) return;
        
        chat.messages.push({
            from: 'admin',
            text: text,
            time: new Date().toISOString()
        });
        chat.lastMessage = text;
        chat.updatedAt = new Date().toISOString();
        
        await this.storage.set('chats', chats);
        input.value = '';
        
        await this.openChat(this.currentChatId);
        await this.renderChatList();
        this.toast.success('تم', 'تم إرسال الرد');
    }
    
    // ===== التقارير =====
    async generateSalesReport() {
        const period = document.getElementById('salesReportPeriod').value;
        const sales = (await this.storage.get('sales', [])).filter(s => s.status !== 'cancelled');
        const now = new Date();
        let filteredSales = sales;
        
        if (period === 'today') {
            const today = now.toDateString();
            filteredSales = sales.filter(s => new Date(s.date).toDateString() === today);
        } else if (period === 'week') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            filteredSales = sales.filter(s => new Date(s.date) >= weekAgo);
        } else if (period === 'month') {
            const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            filteredSales = sales.filter(s => new Date(s.date) >= monthAgo);
        } else if (period === 'year') {
            const yearStart = new Date(now.getFullYear(), 0, 1);
            filteredSales = sales.filter(s => new Date(s.date) >= yearStart);
        }
        
        const totalSales = filteredSales.length;
        const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
        const totalPaid = filteredSales.reduce((sum, s) => sum + (s.paid || s.total), 0);
        const totalRemaining = filteredSales.reduce((sum, s) => sum + (s.remaining || 0), 0);
        const totalProfit = filteredSales.reduce((sum, sale) => {
            return sum + sale.items.reduce((itemSum, item) => {
                const products = this.storage.get('products', []);
                const product = products.find(p => p.id === item.productId);
                const cost = product ? product.purchasePrice * item.quantity : 0;
                return itemSum + (item.total - cost);
            }, 0);
        }, 0);
        
        const container = document.getElementById('salesReportContent');
        container.innerHTML = `
            <div class="report-summary">
                <div class="report-item"><h4>عدد الفواتير</h4><div class="value">${totalSales}</div></div>
                <div class="report-item"><h4>إجمالي المبيعات</h4><div class="value">${this.formatCurrency(totalRevenue)}</div></div>
                <div class="report-item"><h4>المحصّل</h4><div class="value" style="color:#27AE60">${this.formatCurrency(totalPaid)}</div></div>
                <div class="report-item"><h4>المتبقي</h4><div class="value" style="color:#E74C3C">${this.formatCurrency(totalRemaining)}</div></div>
                <div class="report-item"><h4>صافي الربح</h4><div class="value" style="color:#FF6700">${this.formatCurrency(totalProfit)}</div></div>
            </div>
            <h4 style="margin:20px 0 10px;font-size:15px">تفاصيل الفواتير</h4>
            <div style="max-height:300px;overflow-y:auto">
                ${filteredSales.length === 0 ? '<div class="empty-state"><i class="fas fa-chart-line"></i><p>لا توجد مبيعات</p></div>' : `
                    ${filteredSales.slice().reverse().map(s => `
                        <div class="list-item">
                            <div class="list-item-info">
                                <div class="list-item-title">${s.invoiceNumber}</div>
                                <div class="list-item-subtitle">${s.customerName} - ${this.formatDateTime(s.date)}</div>
                            </div>
                            <div class="list-item-value">${this.formatCurrency(s.total)}</div>
                        </div>
                    `).join('')}
                `}
            </div>
            <button class="btn btn-primary mt-2" onclick="app.printSalesReport('${period}')"><i class="fas fa-print"></i> طباعة التقرير</button>
        `;
    }
    
    async printSalesReport(period) {
        const periodNames = { today: 'اليوم', week: 'هذا الأسبوع', month: 'هذا الشهر', year: 'هذه السنة' };
        const sales = (await this.storage.get('sales', [])).filter(s => s.status !== 'cancelled');
        const now = new Date();
        let filteredSales = sales;
        
        if (period === 'today') {
            const today = now.toDateString();
            filteredSales = sales.filter(s => new Date(s.date).toDateString() === today);
        } else if (period === 'week') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            filteredSales = sales.filter(s => new Date(s.date) >= weekAgo);
        } else if (period === 'month') {
            const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            filteredSales = sales.filter(s => new Date(s.date) >= monthAgo);
        } else if (period === 'year') {
            const yearStart = new Date(now.getFullYear(), 0, 1);
            filteredSales = sales.filter(s => new Date(s.date) >= yearStart);
        }
        
        const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
        const settings = await this.storage.get('settings', {});
        
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        printWindow.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>تقرير المبيعات</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Tahoma,Arial;padding:20px}
.header{text-align:center;border-bottom:3px solid #FF6700;padding-bottom:15px;margin-bottom:20px}.header h1{color:#FF6700;font-size:28px}.header p{color:#6c757d;margin-top:5px}
.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin-bottom:25px}.summary-item{background:#f8f9fa;padding:15px;border-radius:8px;text-align:center}.summary-item h4{font-size:12px;color:#6c757d;margin-bottom:5px}.summary-item .value{font-size:20px;font-weight:800;color:#FF6700}
table{width:100%;border-collapse:collapse}th{background:#FF6700;color:white;padding:10px;text-align:right}td{padding:10px;border-bottom:1px solid #dee2e6}
.footer{margin-top:40px;text-align:center;color:#6c757d;font-size:12px}</style></head>
<body><div class="header"><h1>${settings.storeName || 'Mi Store'}</h1><p>تقرير المبيعات - ${periodNames[period]}</p><p>تاريخ التقرير: ${this.formatDateTime(new Date().toISOString())}</p></div>
<div class="summary"><div class="summary-item"><h4>عدد الفواتير</h4><div class="value">${filteredSales.length}</div></div><div class="summary-item"><h4>إجمالي المبيعات</h4><div class="value">${this.formatCurrency(totalRevenue)}</div></div><div class="summary-item"><h4>صافي الربح</h4><div class="value">${this.formatCurrency(totalRevenue * 0.2)}</div></div></div>
<table><thead><tr><th>#</th><th>رقم الفاتورة</th><th>التاريخ</th><th>العميل</th><th>الإجمالي</th></tr></thead><tbody>${filteredSales.map((s, i) => `<tr><td>${i + 1}</td><td>${s.invoiceNumber}</td><td>${this.formatDateTime(s.date)}</td><td>${s.customerName}</td><td>${this.formatCurrency(s.total)}</td></tr>`).join('')}</tbody></table>
<div class="footer"><p>${settings.storeName || 'Mi Store'}</p></div><script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
        printWindow.document.close();
    }
    
    // ===== الطباعة المتقدمة =====
    async showPrintInvoiceModal() {
        const sales = await this.storage.get('sales', []);
        const purchases = await this.storage.get('purchases', []);
        const body = `
            <div class="form-group"><label>نوع الفاتورة</label>
                <select class="form-select" id="printInvoiceType" onchange="app.updateInvoiceList()">
                    <option value="sales">فواتير المبيعات</option>
                    <option value="purchases">فواتير المشتريات</option>
                </select>
            </div>
            <div class="form-group"><label>اختر الفاتورة</label>
                <select class="form-select" id="printInvoiceSelect">
                    ${sales.map(s => `<option value="${s.id}">${s.invoiceNumber} - ${s.customerName}</option>`).join('')}
                </select>
            </div>
        `;
        const footer = `
            <button class="btn btn-outline" onclick="app.modal.close()">إلغاء</button>
            <button class="btn btn-primary" onclick="app.printSelectedInvoice()"><i class="fas fa-print"></i> طباعة</button>
        `;
        this.modal.open('طباعة فاتورة', body, footer);
    }
    
    async updateInvoiceList() {
        const type = document.getElementById('printInvoiceType').value;
        const select = document.getElementById('printInvoiceSelect');
        if (type === 'sales') {
            const sales = await this.storage.get('sales', []);
            select.innerHTML = sales.map(s => `<option value="${s.id}">${s.invoiceNumber} - ${s.customerName}</option>`).join('');
        } else {
            const purchases = await this.storage.get('purchases', []);
            select.innerHTML = purchases.map(p => `<option value="${p.id}">${p.invoiceNumber} - ${p.supplierName}</option>`).join('');
        }
    }
    
    async printSelectedInvoice() {
        const type = document.getElementById('printInvoiceType').value;
        const id = parseInt(document.getElementById('printInvoiceSelect').value);
        if (type === 'sales') await this.printSale(id);
        else await this.printPurchase(id);
        this.modal.close();
    }
    
    async showPrintBarcodeModal() {
        const products = await this.storage.get('products', []);
        const body = `
            <div class="form-group"><label>اختر المنتج</label>
                <select class="form-select" id="barcodeProduct">
                    ${products.map(p => `<option value="${p.id}">${p.code} - ${p.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>عدد النسخ</label>
                <input type="number" class="form-input" id="barcodeCopies" value="1" min="1" max="50">
            </div>
        `;
        const footer = `
            <button class="btn btn-outline" onclick="app.modal.close()">إلغاء</button>
            <button class="btn btn-primary" onclick="app.printBarcode()"><i class="fas fa-print"></i> طباعة</button>
        `;
        this.modal.open('طباعة باركود', body, footer);
    }
    
    async printBarcode() {
        const productId = parseInt(document.getElementById('barcodeProduct').value);
        const copies = parseInt(document.getElementById('barcodeCopies').value) || 1;
        const products = await this.storage.get('products', []);
        const product = products.find(p => p.id === productId);
        if (!product) return;
        const settings = await this.storage.get('settings', {});
        const printWindow = window.open('', '_blank', 'width=600,height=400');
        printWindow.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>باركود</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;padding:20px}
.barcode-label{border:2px solid #000;padding:15px;margin-bottom:15px;text-align:center;page-break-inside:avoid}
.store-name{font-size:14px;font-weight:bold;margin-bottom:8px}.product-name{font-size:12px;margin-bottom:8px}
.barcode{font-size:40px;letter-spacing:2px;margin:10px 0}.barcode-text{font-size:14px;font-weight:bold}.price{font-size:16px;font-weight:bold;margin-top:8px;color:#FF6700}</style></head>
<body>${Array(copies).fill(`<div class="barcode-label"><div class="store-name">${settings.storeName || 'Mi Store'}</div><div class="product-name">${product.name}</div><div class="barcode">*${product.code}*</div><div class="barcode-text">${product.code}</div><div class="price">${this.formatCurrency(product.salePrice)}</div></div>`).join('')}
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
        printWindow.document.close();
        this.modal.close();
    }
    
    async showPrintReportModal() {
        const body = `
            <div class="form-group"><label>نوع التقرير</label>
                <select class="form-select" id="reportType">
                    <option value="sales">تقرير المبيعات</option>
                    <option value="inventory">تقرير المخزون</option>
                    <option value="products">قائمة المنتجات</option>
                    <option value="suppliers">قائمة الموردين</option>
                    <option value="customers">قائمة العملاء</option>
                </select>
            </div>
        `;
        const footer = `
            <button class="btn btn-outline" onclick="app.modal.close()">إلغاء</button>
            <button class="btn btn-primary" onclick="app.printReport()"><i class="fas fa-print"></i> طباعة</button>
        `;
        this.modal.open('طباعة تقرير', body, footer);
    }
    
    async printReport() {
        const type = document.getElementById('reportType').value;
        const settings = await this.storage.get('settings', {});
        let content = '', title = '';
        
        if (type === 'sales') {
            title = 'تقرير المبيعات';
            const sales = await this.storage.get('sales', []);
            content = `<table><thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>العميل</th><th>الإجمالي</th><th>الحالة</th></tr></thead><tbody>${sales.map(s => `<tr><td>${s.invoiceNumber}</td><td>${this.formatDateTime(s.date)}</td><td>${s.customerName}</td><td>${this.formatCurrency(s.total)}</td><td>${s.status === 'paid' ? 'مدفوعة' : 'معلقة'}</td></tr>`).join('')}</tbody></table>`;
        } else if (type === 'inventory') {
            title = 'تقرير المخزون';
            const products = await this.storage.get('products', []);
            content = `<table><thead><tr><th>الكود</th><th>المنتج</th><th>الرصيد</th><th>الحد الأدنى</th><th>الحالة</th></tr></thead><tbody>${products.map(p => `<tr><td>${p.code}</td><td>${p.name}</td><td>${p.quantity}</td><td>${p.minQuantity}</td><td>${p.quantity === 0 ? 'نفذ' : p.quantity <= p.minQuantity ? 'منخفض' : 'متوفر'}</td></tr>`).join('')}</tbody></table>`;
        } else if (type === 'products') {
            title = 'قائمة المنتجات';
            const products = await this.storage.get('products', []);
            content = `<table><thead><tr><th>الكود</th><th>المنتج</th><th>سعر الشراء</th><th>سعر البيع</th><th>الكمية</th></tr></thead><tbody>${products.map(p => `<tr><td>${p.code}</td><td>${p.name}</td><td>${this.formatCurrency(p.purchasePrice)}</td><td>${this.formatCurrency(p.salePrice)}</td><td>${p.quantity}</td></tr>`).join('')}</tbody></table>`;
        } else if (type === 'suppliers') {
            title = 'قائمة الموردين';
            const suppliers = await this.storage.get('suppliers', []);
            content = `<table><thead><tr><th>الكود</th><th>الاسم</th><th>الهاتف</th><th>العنوان</th><th>الرصيد</th></tr></thead><tbody>${suppliers.map(s => `<tr><td>${s.code}</td><td>${s.name}</td><td>${s.phone}</td><td>${s.address || '-'}</td><td>${this.formatCurrency(s.balance)}</td></tr>`).join('')}</tbody></table>`;
        } else if (type === 'customers') {
            title = 'قائمة العملاء';
            const customers = await this.storage.get('customers', []);
            content = `<table><thead><tr><th>الكود</th><th>الاسم</th><th>الهاتف</th><th>العنوان</th><th>الرصيد</th></tr></thead><tbody>${customers.map(c => `<tr><td>${c.code}</td><td>${c.name}</td><td>${c.phone}</td><td>${c.address || '-'}</td><td>${this.formatCurrency(c.balance)}</td></tr>`).join('')}</tbody></table>`;
        }
        
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        printWindow.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${title}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Tahoma,Arial;padding:20px}.header{text-align:center;border-bottom:3px solid #FF6700;padding-bottom:15px;margin-bottom:20px}.header h1{color:#FF6700;font-size:28px}.header p{color:#6c757d;margin-top:5px}table{width:100%;border-collapse:collapse}th{background:#FF6700;color:white;padding:10px;text-align:right}td{padding:10px;border-bottom:1px solid #dee2e6}.footer{margin-top:40px;text-align:center;color:#6c757d;font-size:12px}</style></head>
<body><div class="header"><h1>${settings.storeName || 'Mi Store'}</h1><p>${title}</p><p>تاريخ التقرير: ${this.formatDateTime(new Date().toISOString())}</p></div>${content}<div class="footer"><p>${settings.storeName || 'Mi Store'}</p></div><script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
        printWindow.document.close();
        this.modal.close();
    }
    
    // ===== أدوات مساعدة إضافية =====
    async generateCode(prefix) {
        const items = await this.storage.get(prefix === 'SUP' ? 'suppliers' : 'customers', []);
        const lastNum = items.length > 0 ? Math.max(...items.map(i => {
            const match = i.code?.match(/-(\d+)$/);
            return match ? parseInt(match[1]) : 0;
        })) : 0;
        return `${prefix}-${String(lastNum + 1).padStart(3, '0')}`;
    }
    
    formatTimeAgo(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (minutes < 1) return 'الآن';
        if (minutes < 60) return `منذ ${minutes} د`;
        if (hours < 24) return `منذ ${hours} س`;
        if (days < 7) return `منذ ${days} ي`;
        return this.formatDate(dateStr);
    }
    
    formatTime(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
    }
    
    // ===== تبويبات الإعدادات =====
    showSettingsTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.settings-tab-content').forEach(content => content.classList.remove('active'));
        event.target.closest('.tab-btn').classList.add('active');
        document.getElementById(tabName + 'Settings').classList.add('active');
        if (tabName === 'about') {
            this.loadAboutSettings();
        }
    }
    
    async loadAboutSettings() {
        const about = await this.storage.get('about', {});
        document.getElementById('aboutTitle').value = about.title || 'من نحن';
        document.getElementById('aboutDescription').value = about.description || '';
        document.getElementById('feature1Title').value = about.features?.[0]?.title || '';
        document.getElementById('feature1Desc').value = about.features?.[0]?.desc || '';
        document.getElementById('feature2Title').value = about.features?.[1]?.title || '';
        document.getElementById('feature2Desc').value = about.features?.[1]?.desc || '';
        document.getElementById('feature3Title').value = about.features?.[2]?.title || '';
        document.getElementById('feature3Desc').value = about.features?.[2]?.desc || '';
        document.getElementById('feature4Title').value = about.features?.[3]?.title || '';
        document.getElementById('feature4Desc').value = about.features?.[3]?.desc || '';
        document.getElementById('statYears').value = about.stats?.years || '';
        document.getElementById('statCustomers').value = about.stats?.customers || '';
        document.getElementById('statProducts').value = about.stats?.products || '';
    }
    
    async saveAboutSettings() {
        const about = {
            title: document.getElementById('aboutTitle').value.trim(),
            description: document.getElementById('aboutDescription').value.trim(),
            features: [
                { title: document.getElementById('feature1Title').value.trim(), desc: document.getElementById('feature1Desc').value.trim() },
                { title: document.getElementById('feature2Title').value.trim(), desc: document.getElementById('feature2Desc').value.trim() },
                { title: document.getElementById('feature3Title').value.trim(), desc: document.getElementById('feature3Desc').value.trim() },
                { title: document.getElementById('feature4Title').value.trim(), desc: document.getElementById('feature4Desc').value.trim() }
            ],
            stats: {
                years: document.getElementById('statYears').value.trim(),
                customers: document.getElementById('statCustomers').value.trim(),
                products: document.getElementById('statProducts').value.trim()
            },
            updatedAt: new Date().toISOString()
        };
        await this.storage.set('about', about);
        this.toast.success('تم', 'تم حفظ معلومات "من نحن" بنجاح');
    }
    
    async debugImages() {
        const products = await this.storage.get('products', []);
        console.log('📊 === تقرير الصور ===');
        console.log('عدد المنتجات:', products.length);
        let withImage = 0;
        let withoutImage = 0;
        products.forEach((p, i) => {
            if (p.image) {
                withImage++;
                console.log(`✅ منتج ${i + 1}: ${p.name} - صورة بحجم ${(p.image.length / 1024).toFixed(2)} KB`);
            } else {
                withoutImage++;
                console.log(`❌ منتج ${i + 1}: ${p.name} - بدون صورة`);
            }
        });
        console.log('-------------------');
        console.log(`منتجات بصور: ${withImage}`);
        console.log(`منتجات بدون صور: ${withoutImage}`);
    }
}

// ========== بدء التشغيل ==========
let app;
document.addEventListener('DOMContentLoaded', async () => {
    app = new MiStoreApp();
});
