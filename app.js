// 纸箱报价系统 - 主应用
class QuotationSystem {
    constructor() {
        this.templates = this.loadFromStorage('carton_templates') || this.getDefaultTemplates();
        this.history = this.loadFromStorage('carton_history') || [];
        this.currentQuote = null;
        this.editingTemplateId = null;
        this.viewingHistoryId = null;
        
        this.init();
    }

    // 从localStorage加载数据
    loadFromStorage(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Load from storage error:', e);
            return null;
        }
    }

    // 保存到localStorage
    saveToStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error('Save to storage error:', e);
        }
    }

    // 获取默认模板
    getDefaultTemplates() {
        return [
            {
                id: 'template_1',
                name: '标准外箱 0201',
                type: 'standard',
                marginLength: 5,
                marginWidth: 3,
                description: '通用标准外箱，适合大多数包装需求',
                active: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 'template_2',
                name: '飞机盒',
                type: 'semi-custom',
                marginLength: 7,
                marginWidth: 5,
                description: '电商专用飞机盒，无需胶带',
                active: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 'template_3',
                name: '天地盖',
                type: 'custom',
                marginLength: 8,
                marginWidth: 6,
                description: '高档礼品盒天地盖结构',
                active: true,
                createdAt: new Date().toISOString()
            }
        ];
    }

    // 楞型伸长系数
    getFluteCoefficient(fluteType) {
        const coefficients = {
            'A': 1.53,
            'B': 1.36,
            'C': 1.50,
            'E': 1.27,
            'AB': 2.08,
            'BC': 2.04
        };
        return coefficients[fluteType] || 1.50;
    }

    // 客户等级利润率
    getProfitRate(level) {
        const rates = {
            'normal': 0.15,
            'long-term': 0.10,
            'vip': 0.08
        };
        return rates[level] || 0.15;
    }

    // 印刷成本
    getPrintCost(colors) {
        const costs = {
            '0': 0,
            '1': 0.10,
            '2': 0.18,
            '3': 0.25,
            '4': 0.32
        };
        return costs[colors] || 0;
    }

    // 计算面积 (㎡)
    calculateArea(length, width, height, marginLength = 5, marginWidth = 3) {
        const L = parseFloat(length) || 0;
        const W = parseFloat(width) || 0;
        const H = parseFloat(height) || 0;
        const mL = parseFloat(marginLength) || 5;
        const mW = parseFloat(marginWidth) || 3;
        
        const area = ((L + W + mL) * (W + H * 2 + mW) * 2) / 10000;
        return Math.max(area, 0);
    }

    // 计算报价
    calculateQuotation(data) {
        const {
            length, width, height,
            sizeType, fluteType,
            facePaperWeight, innerPaperWeight, corePaperWeight,
            boardPrice, wasteRate,
            printColors, specialProcess,
            customerLevel, orderQuantity,
            marginLength = 5, marginWidth = 3
        } = data;

        let actualLength = parseFloat(length) || 0;
        let actualWidth = parseFloat(width) || 0;
        let actualHeight = parseFloat(height) || 0;

        if (sizeType === 'inner') {
            const thickness = ['AB', 'BC'].includes(fluteType) ? 0.6 : 0.3;
            actualLength += thickness;
            actualWidth += thickness;
            actualHeight += thickness;
        }

        const area = this.calculateArea(actualLength, actualWidth, actualHeight, marginLength, marginWidth);
        const profitRate = this.getProfitRate(customerLevel);
        const wasteRateDecimal = (parseFloat(wasteRate) || 5) / 100;
        const printCost = this.getPrintCost(printColors);
        const processCost = parseFloat(specialProcess) || 0;

        const materialCost = area * (parseFloat(boardPrice) || 3.5);
        const wasteCost = materialCost * wasteRateDecimal;
        const processCostTotal = area * (printCost + processCost);
        
        const subTotal = materialCost + wasteCost + processCostTotal;
        const profit = subTotal * profitRate;
        const tax = (subTotal + profit) * 0.13;
        
        const unitPrice = subTotal + profit + tax;
        const totalPrice = unitPrice * (parseFloat(orderQuantity) || 1);

        return {
            area,
            materialCost,
            wasteCost,
            processCost: processCostTotal,
            profit,
            tax,
            unitPrice,
            totalPrice
        };
    }

    init() {
        this.bindEvents();
        this.bindNavigation();
        this.bindDataManagement();
        this.renderTemplates();
        this.renderHistory();
        this.updateStats();
        this.populateTemplateSelect();
    }

    bindNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tabName);
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabName);
        });
    }

    bindEvents() {
        document.getElementById('calculateBtn').addEventListener('click', () => this.handleCalculate());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetForm());
        document.getElementById('saveQuoteBtn').addEventListener('click', () => this.saveQuote());
        document.getElementById('exportQuoteBtn').addEventListener('click', () => this.exportQuote());

        document.getElementById('templateSelect').addEventListener('change', (e) => this.applyTemplate(e.target.value));

        document.getElementById('addTemplateBtn').addEventListener('click', () => this.openTemplateModal());
        document.getElementById('saveTemplateBtn').addEventListener('click', () => this.saveTemplate());
        document.querySelectorAll('#templateModal .modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal('templateModal'));
        });

        document.getElementById('searchHistory').addEventListener('input', () => this.renderHistory());
        document.getElementById('filterLevel').addEventListener('change', () => this.renderHistory());

        document.getElementById('copyQuoteBtn').addEventListener('click', () => this.copyQuote());
        document.getElementById('deleteQuoteBtn').addEventListener('click', () => this.deleteQuote());
        document.querySelectorAll('#quoteDetailModal .modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal('quoteDetailModal'));
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }

    bindDataManagement() {
        document.getElementById('exportDataBtn').addEventListener('click', () => this.exportAllData());
        document.getElementById('importDataBtn').addEventListener('click', () => {
            document.getElementById('importFileInput').click();
        });
        document.getElementById('importFileInput').addEventListener('change', (e) => this.importData(e));
        document.getElementById('clearHistoryBtn').addEventListener('click', () => this.clearHistory());
        document.getElementById('resetTemplatesBtn').addEventListener('click', () => this.resetTemplates());
        document.getElementById('clearAllDataBtn').addEventListener('click', () => this.clearAllData());
    }

    handleCalculate() {
        const data = this.getFormData();
        
        if (!data.length || !data.width || !data.height) {
            this.showToast('请填写完整的纸箱尺寸！', 'error');
            return;
        }

        const result = this.calculateQuotation(data);
        this.currentQuote = {
            ...data,
            ...result,
            id: 'quote_' + Date.now(),
            createdAt: new Date().toISOString()
        };

        this.displayResult(result);
        this.showToast('报价计算完成！');
    }

    getFormData() {
        const templateId = document.getElementById('templateSelect').value;
        const template = this.templates.find(t => t.id === templateId);
        
        return {
            templateId,
            templateName: template?.name || '',
            marginLength: template?.marginLength || 5,
            marginWidth: template?.marginWidth || 3,
            customerName: document.getElementById('customerName').value,
            customerLevel: document.getElementById('customerLevel').value,
            orderQuantity: document.getElementById('orderQuantity').value,
            sizeType: document.querySelector('input[name="sizeType"]:checked').value,
            length: document.getElementById('boxLength').value,
            width: document.getElementById('boxWidth').value,
            height: document.getElementById('boxHeight').value,
            fluteType: document.querySelector('input[name="fluteType"]:checked').value,
            facePaperWeight: document.getElementById('facePaperWeight').value,
            innerPaperWeight: document.getElementById('innerPaperWeight').value,
            corePaperWeight: document.getElementById('corePaperWeight').value,
            boardPrice: document.getElementById('boardPrice').value,
            wasteRate: document.getElementById('wasteRate').value,
            printColors: document.getElementById('printColors').value,
            specialProcess: document.getElementById('specialProcess').value
        };
    }

    displayResult(result) {
        document.getElementById('areaResult').textContent = result.area.toFixed(4) + ' ㎡';
        document.getElementById('materialCost').textContent = result.materialCost.toFixed(2);
        document.getElementById('wasteCost').textContent = result.wasteCost.toFixed(2);
        document.getElementById('processCost').textContent = result.processCost.toFixed(2);
        document.getElementById('profitCost').textContent = result.profit.toFixed(2);
        document.getElementById('taxCost').textContent = result.tax.toFixed(2);
        document.getElementById('unitPrice').textContent = '¥' + result.unitPrice.toFixed(2);
        document.getElementById('totalPrice').textContent = '¥' + result.totalPrice.toFixed(2);
        
        document.getElementById('resultCard').style.display = 'block';
    }

    resetForm() {
        document.getElementById('customerName').value = '';
        document.getElementById('customerLevel').value = 'normal';
        document.getElementById('orderQuantity').value = '1000';
        document.querySelector('input[name="sizeType"][value="outer"]').checked = true;
        document.getElementById('boxLength').value = '';
        document.getElementById('boxWidth').value = '';
        document.getElementById('boxHeight').value = '';
        document.querySelector('input[name="fluteType"][value="A"]').checked = true;
        document.getElementById('facePaperWeight').value = '250';
        document.getElementById('innerPaperWeight').value = '250';
        document.getElementById('corePaperWeight').value = '120';
        document.getElementById('boardPrice').value = '3.5';
        document.getElementById('wasteRate').value = '5';
        document.getElementById('printColors').value = '0';
        document.getElementById('specialProcess').value = '0';
        document.getElementById('templateSelect').value = '';
        document.getElementById('resultCard').style.display = 'none';
        this.currentQuote = null;
        this.showToast('表单已重置');
    }

    saveQuote() {
        if (!this.currentQuote) {
            this.showToast('请先计算报价！', 'error');
            return;
        }

        if (!this.currentQuote.customerName) {
            this.showToast('请填写客户名称！', 'error');
            return;
        }

        this.history.unshift(this.currentQuote);
        this.saveToStorage('carton_history', this.history);
        this.renderHistory();
        this.updateStats();
        
        this.showToast('报价保存成功！');
    }

    exportQuote() {
        if (!this.currentQuote) {
            this.showToast('请先计算报价！', 'error');
            return;
        }

        const data = this.currentQuote;
        const content = `
纸箱报价单
=====================================
客户名称: ${data.customerName || '-'}
客户等级: ${this.getLevelLabel(data.customerLevel)}
订单数量: ${data.orderQuantity} 个
创建时间: ${new Date(data.createdAt).toLocaleString('zh-CN')}

纸箱规格
-------------------------------------
尺寸: ${data.length} × ${data.width} × ${data.height} cm (${data.sizeType === 'outer' ? '外径' : '内径'})
楞型: ${data.fluteType}楞
用纸: ${data.facePaperWeight}g/${data.corePaperWeight}g/${data.innerPaperWeight}g

报价明细
-------------------------------------
用料面积: ${data.area.toFixed(4)} ㎡
纸料成本: ${data.materialCost.toFixed(2)} 元
损耗成本: ${data.wasteCost.toFixed(2)} 元
工艺成本: ${data.processCost.toFixed(2)} 元
利润: ${data.profit.toFixed(2)} 元
税费(13%): ${data.tax.toFixed(2)} 元

最终报价
-------------------------------------
单个纸箱: ${data.unitPrice.toFixed(2)} 元
订单总价: ${data.totalPrice.toFixed(2)} 元
=====================================
        `;

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `报价单_${data.customerName || '未命名'}_${new Date().toLocaleDateString('zh-CN')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('报价单导出成功！');
    }

    populateTemplateSelect() {
        const select = document.getElementById('templateSelect');
        select.innerHTML = '<option value="">-- 请选择模板 --</option>';
        
        this.templates.filter(t => t.active).forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = template.name;
            select.appendChild(option);
        });
    }

    applyTemplate(templateId) {
        if (!templateId) return;
        
        const template = this.templates.find(t => t.id === templateId);
        if (template) {
            this.showToast(`已应用模板: ${template.name}`);
        }
    }

    renderTemplates() {
        const container = document.getElementById('templateList');
        
        if (this.templates.length === 0) {
            container.innerHTML = this.getEmptyState('暂无模板', '点击"新建"创建第一个箱型模板');
            return;
        }

        container.innerHTML = this.templates.map(template => `
            <div class="template-item">
                <div class="template-header">
                    <div>
                        <div class="template-name">${template.name}</div>
                    </div>
                    <span class="template-type">${this.getTypeLabel(template.type)}</span>
                </div>
                <div class="template-desc">${template.description || '暂无描述'}</div>
                <div style="color: #6b7280; font-size: 12px; margin-bottom: 12px;">
                    纸长余量: ${template.marginLength}cm | 纸宽余量: ${template.marginWidth}cm
                    ${!template.active ? ' | <span style="color: #ef4444;">已禁用</span>' : ''}
                </div>
                <div class="template-actions">
                    <button class="btn btn-secondary" onclick="app.editTemplate('${template.id}')">编辑</button>
                    <button class="btn btn-danger" onclick="app.deleteTemplate('${template.id}')">删除</button>
                </div>
            </div>
        `).join('');
    }

    getTypeLabel(type) {
        const labels = {
            'standard': '标准箱型',
            'semi-custom': '半定制',
            'custom': '全自定义'
        };
        return labels[type] || type;
    }

    getLevelLabel(level) {
        const labels = {
            'normal': '普通客户',
            'long-term': '长期客户',
            'vip': '大客户'
        };
        return labels[level] || level;
    }

    openTemplateModal(template = null) {
        this.editingTemplateId = template?.id || null;
        document.getElementById('modalTitle').textContent = template ? '编辑模板' : '新建模板';
        
        if (template) {
            document.getElementById('templateName').value = template.name;
            document.getElementById('templateType').value = template.type;
            document.getElementById('marginLength').value = template.marginLength;
            document.getElementById('marginWidth').value = template.marginWidth;
            document.getElementById('templateDesc').value = template.description || '';
            document.getElementById('templateActive').checked = template.active !== false;
        } else {
            document.getElementById('templateName').value = '';
            document.getElementById('templateType').value = 'standard';
            document.getElementById('marginLength').value = '5';
            document.getElementById('marginWidth').value = '3';
            document.getElementById('templateDesc').value = '';
            document.getElementById('templateActive').checked = true;
        }

        document.getElementById('templateModal').classList.add('active');
    }

    editTemplate(id) {
        const template = this.templates.find(t => t.id === id);
        if (template) {
            this.openTemplateModal(template);
        }
    }

    saveTemplate() {
        const name = document.getElementById('templateName').value.trim();
        if (!name) {
            this.showToast('请输入模板名称！', 'error');
            return;
        }

        const templateData = {
            name,
            type: document.getElementById('templateType').value,
            marginLength: parseFloat(document.getElementById('marginLength').value) || 5,
            marginWidth: parseFloat(document.getElementById('marginWidth').value) || 3,
            description: document.getElementById('templateDesc').value.trim(),
            active: document.getElementById('templateActive').checked
        };

        if (this.editingTemplateId) {
            const index = this.templates.findIndex(t => t.id === this.editingTemplateId);
            if (index !== -1) {
                this.templates[index] = { ...this.templates[index], ...templateData };
            }
        } else {
            this.templates.push({
                id: 'template_' + Date.now(),
                ...templateData,
                createdAt: new Date().toISOString()
            });
        }

        this.saveToStorage('carton_templates', this.templates);
        this.renderTemplates();
        this.populateTemplateSelect();
        this.closeModal('templateModal');
        this.showToast('模板保存成功！');
    }

    deleteTemplate(id) {
        if (!confirm('确定要删除这个模板吗？')) return;
        
        this.templates = this.templates.filter(t => t.id !== id);
        this.saveToStorage('carton_templates', this.templates);
        this.renderTemplates();
        this.populateTemplateSelect();
        this.showToast('模板已删除');
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    renderHistory() {
        const container = document.getElementById('historyList');
        const searchTerm = document.getElementById('searchHistory').value.toLowerCase();
        const filterLevel = document.getElementById('filterLevel').value;

        let filteredHistory = this.history;
        
        if (searchTerm) {
            filteredHistory = filteredHistory.filter(h => 
                (h.customerName || '').toLowerCase().includes(searchTerm)
            );
        }
        
        if (filterLevel) {
            filteredHistory = filteredHistory.filter(h => h.customerLevel === filterLevel);
        }

        if (filteredHistory.length === 0) {
            container.innerHTML = this.getEmptyState('暂无记录', '还没有保存过报价记录');
            return;
        }

        container.innerHTML = filteredHistory.map(item => `
            <div class="history-item" onclick="app.viewHistory('${item.id}')">
                <div class="history-header">
                    <div>
                        <div class="history-customer">${item.customerName || '未命名客户'}</div>
                    </div>
                    <span class="history-level">${this.getLevelLabel(item.customerLevel)}</span>
                </div>
                <div class="history-info">
                    ${item.templateName ? `模板: ${item.templateName} | ` : ''}
                    尺寸: ${item.length}×${item.width}×${item.height}cm | 
                    楞型: ${item.fluteType}楞
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #6b7280; font-size: 12px;">
                        ${new Date(item.createdAt).toLocaleString('zh-CN')}
                    </span>
                    <span style="font-weight: 700; color: #667eea; font-size: 18px;">
                        ¥${item.totalPrice.toFixed(2)}
                    </span>
                </div>
            </div>
        `).join('');
    }

    viewHistory(id) {
        const item = this.history.find(h => h.id === id);
        if (!item) return;

        this.viewingHistoryId = id;
        
        const content = `
            <div class="result-details" style="background: #f9fafb;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                    <div>
                        <h4 style="font-size: 13px; color: #6b7280; margin-bottom: 6px;">客户名称</h4>
                        <p style="font-weight: 600; font-size: 15px;">${item.customerName || '-'}</p>
                    </div>
                    <div>
                        <h4 style="font-size: 13px; color: #6b7280; margin-bottom: 6px;">客户等级</h4>
                        <p style="font-weight: 600; font-size: 15px;">${this.getLevelLabel(item.customerLevel)}</p>
                    </div>
                    <div>
                        <h4 style="font-size: 13px; color: #6b7280; margin-bottom: 6px;">订单数量</h4>
                        <p style="font-weight: 600; font-size: 15px;">${item.orderQuantity} 个</p>
                    </div>
                    <div>
                        <h4 style="font-size: 13px; color: #6b7280; margin-bottom: 6px;">楞型</h4>
                        <p style="font-weight: 600; font-size: 15px;">${item.fluteType}楞</p>
                    </div>
                </div>
                
                <div style="background: white; padding: 16px; border-radius: 10px; margin-bottom: 16px;">
                    <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">📐 纸箱规格</h4>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #6b7280;">尺寸</span>
                        <span style="font-weight: 500;">${item.length}×${item.width}×${item.height}cm (${item.sizeType === 'outer' ? '外径' : '内径'})</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #6b7280;">用纸</span>
                        <span style="font-weight: 500;">${item.facePaperWeight}g/${item.corePaperWeight}g/${item.innerPaperWeight}g</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #6b7280;">用料面积</span>
                        <span style="font-weight: 500;">${item.area.toFixed(4)} ㎡</span>
                    </div>
                </div>
                
                <div style="background: white; padding: 16px; border-radius: 10px; margin-bottom: 16px;">
                    <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">💰 成本明细</h4>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #6b7280;">纸料成本</span>
                        <span style="font-weight: 500;">¥${item.materialCost.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #6b7280;">损耗成本</span>
                        <span style="font-weight: 500;">¥${item.wasteCost.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #6b7280;">工艺成本</span>
                        <span style="font-weight: 500;">¥${item.processCost.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #6b7280;">利润</span>
                        <span style="font-weight: 500;">¥${item.profit.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #6b7280;">税费(13%)</span>
                        <span style="font-weight: 500;">¥${item.tax.toFixed(2)}</span>
                    </div>
                </div>
                
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; color: white;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="opacity: 0.9;">单个纸箱</span>
                        <span style="font-size: 22px; font-weight: 700;">¥${item.unitPrice.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="opacity: 0.9;">订单总价</span>
                        <span style="font-size: 28px; font-weight: 800;">¥${item.totalPrice.toFixed(2)}</span>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 16px; font-size: 12px; color: #6b7280;">
                    创建时间: ${new Date(item.createdAt).toLocaleString('zh-CN')}
                </div>
            </div>
        `;
        
        document.getElementById('quoteDetailContent').innerHTML = content;
        document.getElementById('quoteDetailModal').classList.add('active');
    }

    copyQuote() {
        const item = this.history.find(h => h.id === this.viewingHistoryId);
        if (!item) return;

        document.getElementById('customerName').value = item.customerName || '';
        document.getElementById('customerLevel').value = item.customerLevel;
        document.getElementById('orderQuantity').value = item.orderQuantity;
        document.querySelector(`input[name="sizeType"][value="${item.sizeType}"]`).checked = true;
        document.getElementById('boxLength').value = item.length;
        document.getElementById('boxWidth').value = item.width;
        document.getElementById('boxHeight').value = item.height;
        document.querySelector(`input[name="fluteType"][value="${item.fluteType}"]`).checked = true;
        document.getElementById('facePaperWeight').value = item.facePaperWeight;
        document.getElementById('innerPaperWeight').value = item.innerPaperWeight;
        document.getElementById('corePaperWeight').value = item.corePaperWeight;
        document.getElementById('boardPrice').value = item.boardPrice;
        document.getElementById('wasteRate').value = item.wasteRate;
        document.getElementById('printColors').value = item.printColors;
        document.getElementById('specialProcess').value = item.specialProcess;
        document.getElementById('templateSelect').value = item.templateId || '';
        
        this.closeModal('quoteDetailModal');
        this.switchTab('quotation');
        document.getElementById('resultCard').style.display = 'none';
        
        this.showToast('已复制报价信息，可修改后重新计算！');
    }

    deleteQuote() {
        if (!confirm('确定要删除这条报价记录吗？')) return;
        
        this.history = this.history.filter(h => h.id !== this.viewingHistoryId);
        this.saveToStorage('carton_history', this.history);
        this.renderHistory();
        this.updateStats();
        this.closeModal('quoteDetailModal');
        this.showToast('报价记录已删除');
    }

    updateStats() {
        const totalQuotes = this.history.length;
        const totalAmount = this.history.reduce((sum, h) => sum + h.totalPrice, 0);
        const avgUnitPrice = totalQuotes > 0 
            ? this.history.reduce((sum, h) => sum + h.unitPrice, 0) / totalQuotes 
            : 0;

        document.getElementById('totalQuotes').textContent = totalQuotes;
        document.getElementById('totalAmount').textContent = '¥' + totalAmount.toFixed(0);
        document.getElementById('avgUnitPrice').textContent = '¥' + avgUnitPrice.toFixed(2);
    }

    // 数据导出
    exportAllData() {
        const data = {
            version: '1.0.0',
            exportTime: new Date().toISOString(),
            templates: this.templates,
            history: this.history
        };
        
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `纸箱报价系统备份_${new Date().toLocaleDateString('zh-CN')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showToast('数据导出成功！');
    }

    // 数据导入
    importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!confirm('导入数据会覆盖现有数据，确定要继续吗？')) {
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (!data.templates || !data.history) {
                    throw new Error('Invalid data format');
                }
                
                this.templates = data.templates;
                this.history = data.history;
                
                this.saveToStorage('carton_templates', this.templates);
                this.saveToStorage('carton_history', this.history);
                
                this.renderTemplates();
                this.renderHistory();
                this.updateStats();
                this.populateTemplateSelect();
                
                this.showToast('数据导入成功！');
            } catch (error) {
                this.showToast('数据导入失败，请检查文件格式！', 'error');
            }
        };
        
        reader.readAsText(file);
        event.target.value = '';
    }

    // 清空历史
    clearHistory() {
        if (!confirm('确定要清空所有报价历史记录吗？此操作不可恢复！')) return;
        
        this.history = [];
        this.saveToStorage('carton_history', this.history);
        this.renderHistory();
        this.updateStats();
        this.showToast('历史记录已清空');
    }

    // 重置模板
    resetTemplates() {
        if (!confirm('确定要重置为默认模板吗？此操作不可恢复！')) return;
        
        this.templates = this.getDefaultTemplates();
        this.saveToStorage('carton_templates', this.templates);
        this.renderTemplates();
        this.populateTemplateSelect();
        this.showToast('模板已重置为默认值');
    }

    // 清除所有数据
    clearAllData() {
        if (!confirm('确定要清除所有数据吗？此操作不可恢复！')) return;
        if (!confirm('这是最后一次确认，所有数据将被永久删除！')) return;
        
        this.templates = this.getDefaultTemplates();
        this.history = [];
        
        this.saveToStorage('carton_templates', this.templates);
        this.saveToStorage('carton_history', this.history);
        
        this.renderTemplates();
        this.renderHistory();
        this.updateStats();
        this.populateTemplateSelect();
        
        this.showToast('所有数据已清除');
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast show';
        
        if (type === 'error') {
            toast.style.background = '#ef4444';
        } else {
            toast.style.background = '#1d1d1f';
        }
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    getEmptyState(title, subtitle) {
        return `
            <div class="empty-state">
                <div class="empty-icon">📦</div>
                <div class="empty-text">${title}</div>
                <div class="empty-subtext">${subtitle}</div>
            </div>
        `;
    }
}

const app = new QuotationSystem();
