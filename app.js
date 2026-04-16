/**
 * 温暖手账 - 智能日程管理
 * 支持智能文本识别、时间解析、本地存储
 */

// 自动同步管理器
const AutoSync = {
    syncTimeout: null,
    SYNC_DELAY: 3000, // 3秒后自动同步
    
    // 触发自动同步（防抖）
    trigger() {
        // 清除之前的定时器
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
        }
        // 设置新的定时器
        this.syncTimeout = setTimeout(() => {
            this.sync();
        }, this.SYNC_DELAY);
    },
    
    // 执行同步
    async sync() {
        const settings = JSON.parse(localStorage.getItem('gist-settings') || '{}');
        if (!settings.token || !settings.gistId) {
            return; // 未配置不同步
        }
        
        try {
            const data = {
                tasks: Storage.getAll(),
                ideas: IdeasStorage.getAll(),
                syncTime: new Date().toISOString(),
                version: '1.0'
            };
            
            const body = {
                description: '小爱酱账数据备份',
                public: false,
                files: {
                    'xiaoaizhang-data.json': {
                        content: JSON.stringify(data, null, 2)
                    }
                }
            };
            
            const response = await fetch(`https://api.github.com/gists/${settings.gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${settings.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            
            if (response.ok) {
                console.log('自动同步成功:', new Date().toLocaleString());
                // 显示同步指示器
                UI.showSyncIndicator();
            }
        } catch (err) {
            console.error('自动同步失败:', err);
        }
    },
    
    // 页面加载时从云端下载
    async downloadOnLoad() {
        const settings = JSON.parse(localStorage.getItem('gist-settings') || '{}');
        if (!settings.token || !settings.gistId) {
            return; // 未配置不下载
        }
        
        try {
            const response = await fetch(`https://api.github.com/gists/${settings.gistId}`, {
                headers: {
                    'Authorization': `token ${settings.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (!response.ok) return;
            
            const result = await response.json();
            const fileContent = result.files['xiaoaizhang-data.json']?.content;
            if (!fileContent) return;
            
            const data = JSON.parse(fileContent);
            const localTasks = Storage.getAll();
            const localIdeas = IdeasStorage.getAll();
            
            // 合并策略：以云端数据为准，但保留本地独有的数据
            let hasChanges = false;
            
            if (data.tasks && Array.isArray(data.tasks)) {
                // 创建云端任务ID映射
                const cloudTaskIds = new Set(data.tasks.map(t => t.id));
                // 找出本地独有的任务
                const localOnlyTasks = localTasks.filter(t => !cloudTaskIds.has(t.id));
                // 合并：云端数据 + 本地独有
                const mergedTasks = [...data.tasks, ...localOnlyTasks];
                Storage.save(mergedTasks);
                if (localOnlyTasks.length > 0) hasChanges = true;
            }
            
            if (data.ideas && Array.isArray(data.ideas)) {
                const cloudIdeaIds = new Set(data.ideas.map(i => i.id));
                const localOnlyIdeas = localIdeas.filter(i => !cloudIdeaIds.has(i.id));
                const mergedIdeas = [...data.ideas, ...localOnlyIdeas];
                IdeasStorage.save(mergedIdeas);
                if (localOnlyIdeas.length > 0) hasChanges = true;
            }
            
            // 如果有本地独有数据，上传合并后的结果
            if (hasChanges) {
                setTimeout(() => this.sync(), 1000);
            }
            
            console.log('初始同步完成:', new Date(data.syncTime).toLocaleString());
            UI.showToast('数据已同步');
        } catch (err) {
            console.error('初始同步失败:', err);
        }
    }
};

// 数据存储
const Storage = {
    KEY: 'warm-diary-tasks',
    
    getAll() {
        const data = localStorage.getItem(this.KEY);
        return data ? JSON.parse(data) : [];
    },
    
    save(tasks) {
        localStorage.setItem(this.KEY, JSON.stringify(tasks));
        AutoSync.trigger(); // 触发自动同步
    },
    
    add(task) {
        const tasks = this.getAll();
        task.id = Date.now().toString();
        task.createdAt = new Date().toISOString();
        task.completed = false;
        tasks.push(task);
        this.save(tasks);
        return task;
    },
    
    update(id, updates) {
        const tasks = this.getAll();
        const index = tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            tasks[index] = { ...tasks[index], ...updates };
            this.save(tasks);
            return tasks[index];
        }
        return null;
    },
    
    delete(id) {
        const tasks = this.getAll();
        const filtered = tasks.filter(t => t.id !== id);
        this.save(filtered);
    },
    
    toggleComplete(id) {
        const tasks = this.getAll();
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            this.save(tasks);
            return task.completed;
        }
        return null;
    }
};

// 奇思妙想存储
const IdeasStorage = {
    KEY: 'warm-diary-ideas',
    
    getAll() {
        const data = localStorage.getItem(this.KEY);
        return data ? JSON.parse(data) : [];
    },
    
    save(ideas) {
        localStorage.setItem(this.KEY, JSON.stringify(ideas));
        AutoSync.trigger(); // 触发自动同步
    },
    
    add(idea) {
        const ideas = this.getAll();
        idea.id = Date.now().toString();
        idea.createdAt = new Date().toISOString();
        ideas.unshift(idea);
        this.save(ideas);
        return idea;
    },
    
    update(id, updates) {
        const ideas = this.getAll();
        const index = ideas.findIndex(i => i.id === id);
        if (index !== -1) {
            ideas[index] = { ...ideas[index], ...updates };
            this.save(ideas);
            return ideas[index];
        }
        return null;
    },
    
    delete(id) {
        const ideas = this.getAll();
        const filtered = ideas.filter(i => i.id !== id);
        this.save(filtered);
    }
};

// 智能识别
const SmartRecognizer = {
    // 关键词分类 - 增强版
    WORK_KEYWORDS: ['会议', '报告', '项目', '提交', '截止', 'deadline', '工作', '部门', '领导', '客户', '合同', '审批', '汇报', '总结', '计划', '任务', '考核', '指标', '材料', '文件', '通知', '简报', '投稿', '邮箱', '邮件', 'OA', '常委会', '办公会', '党委', '党组织', '学院', '学校', '校长', '处长', '主任', '负责人', '填报', '征求意见', '阅文', '听课'],
    LIFE_KEYWORDS: ['约会', '聚餐', '吃饭', '电影', '逛街', '购物', '健身', '运动', '瑜伽', '跑步', '游泳', '生理期', '月经', '针灸', '推拿', '按摩', '医院', '看病', '牙医', '理发', '美容', '聚会', '生日', '旅行', '旅游', '朋友', '家人', '亲戚'],
    
    // 标题模板 - 增强版
    TITLE_TEMPLATES: {
        work: {
            meeting: ['部门会议', '工作会议', '项目会议', '讨论会', '汇报会', '常委会', '办公会'],
            report: ['提交报告', '材料提交', '工作总结', '项目汇报', '投稿', '填报'],
            deadline: ['截止提醒', '到期提醒', '任务截止', 'OA截止'],
            notice: ['阅文通知', '通知提醒', '文件查阅'],
            default: ['工作安排', '工作任务', '工作事项']
        },
        life: {
            medical: ['看病预约', '医院复查', '健康检查', '理疗预约'],
            social: ['朋友聚会', '社交活动', '约会安排'],
            fitness: ['健身计划', '运动安排'],
            default: ['生活安排', '个人事项', '生活备忘']
        }
    },
    
    // 时间关键词 - 增强版
    TIME_PATTERNS: [
        // 明天（4月15日）下午17：00前 - 带括号月/日的相对时间（支持"前"后缀）
        { pattern: /明天[（(](\d{1,2})月(\d{1,2})[日号]?[)）][上午下午晚上]*\s*(\d+)[点:：](\d*)[前]?/, handler: (m) => SmartRecognizer.getBracketDate(m[1], m[2], m[3], m[4] || '00') },
        // 明天（14日）上午9:30 - 带括号只有日的相对时间（使用当前月份）
        { pattern: /明天[（(](\d{1,2})[日号]?[)）][上午下午晚上]*\s*(\d+)[点:：](\d*)[前]?/, handler: (m) => SmartRecognizer.getBracketDayOnly(m[1], m[2], m[3] || '00') },
        // 投稿时间/截止时间.*明天（4月15日）下午17：00前 - 带前缀词
        { pattern: /(?:投稿时间|截止时间|时间|至|到|于)[：:]?\s*明天[（(](\d{1,2})月(\d{1,2})[日号][)）][上午下午晚上]*\s*(\d+)[点:：](\d*)[前]?/, handler: function(m) { return this.getBracketDate(m[1], m[2], m[3], m[4] || '00'); } },
        // 投稿时间/截止时间.*明天下午17：00前 - 带前缀词
        { pattern: /(?:投稿时间|截止时间|时间|至|到|于)[：:]?\s*明天[上午下午晚上]*\s*(\d+)[点:：](\d*)[前]?/, handler: function(m) { return this.getRelativeDate(1, m[1], m[2] || '00'); } },
        // 明天下午17：00前
        { pattern: /明天[上午下午晚上]*\s*(\d+)[点:：](\d*)[前]?/, handler: function(m) { return this.getRelativeDate(1, m[1], m[2] || '00'); } },
        // 延长至明天（4月15日）下午17：00前
        { pattern: /延长至明天[（(](\d{1,2})月(\d{1,2})[日号][)）][上午下午晚上]*\s*(\d+)[点:：](\d*)[前]?/, handler: function(m) { return this.getBracketDate(m[1], m[2], m[3], m[4] || '00'); } },
        // 延长至明天下午17：00前
        { pattern: /延长至明天[上午下午晚上]*\s*(\d+)[点:：](\d*)[前]?/, handler: function(m) { return this.getRelativeDate(1, m[1], m[2] || '00'); } },
        // 后天
        { pattern: /后天[上午下午晚上]*\s*(\d+)[点:：](\d*)/, handler: function(m) { return this.getRelativeDate(2, m[1], m[2] || '00'); } },
        // 今天
        { pattern: /今天[上午下午晚上]*\s*(\d+)[点:：](\d*)/, handler: function(m) { return this.getRelativeDate(0, m[1], m[2] || '00'); } },
        // 下周X
        { pattern: /下周([一二三四五六日])[上午下午晚上]*\s*(\d+)?[点:：]?(\d*)/, handler: function(m) { return this.getNextWeekDay(m[1], m[2] || '9', m[3] || '00'); } },
        // 本周X / 周X
        { pattern: /(下*)周([一二三四五六日])[上午下午晚上]*\s*(\d+)?[点:：]?(\d*)/, handler: function(m) { return this.getWeekDay(m[1], m[2], m[3] || '9', m[4] || '00'); } },
        // 2026年4月7日（周二）17:00前 - 带星期几的完整日期
        { pattern: /(\d{4})年(\d{1,2})月(\d{1,2})[日号][（(][周星期][一二三四五六日][)）][上午下午晚上]*\s*(\d+)?[点:：]?(\d*)/, handler: function(m) { return this.getFullDate(m[1], m[2], m[3], m[4] || '9', m[5] || '00'); } },
        // 2026年4月7日14:00（无空格，直接数字时间）
        { pattern: /(\d{4})年(\d{1,2})月(\d{1,2})[日号](\d{1,2})[点:：](\d{2})/, handler: function(m) { 
            const year = m[1];
            const month = m[2].padStart(2, '0');
            const day = m[3].padStart(2, '0');
            const hour = m[4].padStart(2, '0');
            const minute = m[5];
            return `${year}-${month}-${day}T${hour}:${minute}`;
        } },
        // 2026年4月7日 17:00（有空格）
        { pattern: /(\d{4})年(\d{1,2})月(\d{1,2})[日号][上午下午晚上]*\s*(\d+)?[点:：]?(\d*)/, handler: function(m) { return this.getFullDate(m[1], m[2], m[3], m[4] || '9', m[5] || '00'); } },
        // 4月7日（周二）17:00前
        { pattern: /(\d{1,2})月(\d{1,2})[日号][（(][周星期][一二三四五六日][)）][上午下午晚上]*\s*(\d+)?[点:：]?(\d*)/, handler: function(m) { return this.getSpecificDate(m[1], m[2], m[3] || '9', m[4] || '00'); } },
        // 4月15日上午9:30（无空格紧挨着）- 优先匹配
        { pattern: /(\d{1,2})月(\d{1,2})[日号][上午下午晚上](\d+)[点:：](\d*)/, handler: function(m) { 
            const date = new Date();
            date.setMonth(parseInt(m[1]) - 1, parseInt(m[2]));
            date.setHours(parseInt(m[3]), parseInt(m[4] || '00'), 0, 0);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hour = String(date.getHours()).padStart(2, '0');
            const minute = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hour}:${minute}`;
        } },
        // 4月7日 17:00（有空格版本）
        { pattern: /(\d{1,2})月(\d{1,2})[日号]\s*(\d+)?[点:：]?(\d*)/, handler: function(m) { 
            const date = new Date();
            date.setMonth(parseInt(m[1]) - 1, parseInt(m[2]));
            date.setHours(parseInt(m[3] || '9'), parseInt(m[4] || '00'), 0, 0);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hour = String(date.getHours()).padStart(2, '0');
            const minute = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hour}:${minute}`;
        } },
        // 时间段 4月13日-17日
        { pattern: /(\d{1,2})月(\d{1,2})[日号][\-~至](\d{1,2})[日号]?/, handler: function(m) { return this.getDateRangeStart(m[1], m[2]); } },
        // 2026-04-07 或 2026/04/07
        { pattern: /(\d{4})[-/](\d{1,2})[-/](\d{1,2})[上午下午晚上]*\s*(\d+)?[点:：]?(\d*)/, handler: function(m) { return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}T${(m[4] || '09').padStart(2, '0')}:${(m[5] || '00').padStart(2, '0')}`; } },
        // 4-7 或 4/7
        { pattern: /(\d{1,2})[-/](\d{1,2})[上午下午晚上]*\s*(\d+)?[点:：]?(\d*)/, handler: function(m) { return this.getShortDate(m[1], m[2], m[3] || '9', m[4] || '00'); } },
        // 只有时间（如上午11点）
        { pattern: /[上午下午晚上]+\s*(\d+)[点:：]?(\d*)/, handler: function(m) { return this.getTodayWithPeriod(m[0], m[1], m[2] || '00'); } },
        // 纯数字时间 9:30 或 9：30
        { pattern: /(\d{1,2})[点:：](\d{2})/, handler: function(m) { return this.getTodayTime(m[1], m[2]); } }
    ],
    
    // 获取相对日期
    getRelativeDate(days, hour, minute) {
        const date = new Date();
        date.setDate(date.getDate() + days);
        date.setHours(parseInt(hour), parseInt(minute), 0, 0);
        return this.formatDateTime(date);
    },
    
    // 获取括号中的日期（如"明天（4月15日）"）
    getBracketDate(month, day, hour, minute) {
        const date = new Date();
        date.setMonth(parseInt(month) - 1, parseInt(day));
        date.setHours(parseInt(hour), parseInt(minute), 0, 0);
        return this.formatDateTime(date);
    },
    
    // 获取括号中只有日的日期（如"明天（14日）"）
    getBracketDayOnly(day, hour, minute) {
        const date = new Date();
        date.setDate(parseInt(day));
        date.setHours(parseInt(hour), parseInt(minute), 0, 0);
        return this.formatDateTime(date);
    },
    
    // 获取今天的时间
    getTodayTime(hour, minute) {
        const date = new Date();
        date.setHours(parseInt(hour), parseInt(minute), 0, 0);
        return this.formatDateTime(date);
    },
    
    // 获取时间段开始日期（如"4月13日-17日"取13日）
    getDateRangeStart(month, day) {
        const date = new Date();
        date.setMonth(parseInt(month) - 1, parseInt(day));
        date.setHours(9, 0, 0, 0);
        return this.formatDateTime(date);
    },
    
    // 根据上午/下午/晚上获取今天的时间
    getTodayWithPeriod(fullMatch, hour, minute) {
        const date = new Date();
        let h = parseInt(hour);
        // 处理上午下午晚上
        if (fullMatch.includes('下午') || fullMatch.includes('晚上')) {
            if (h < 12) h += 12;
        }
        date.setHours(h, parseInt(minute), 0, 0);
        return this.formatDateTime(date);
    },
    
    // 获取下周某天
    getNextWeekDay(weekday, hour, minute) {
        const weekMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };
        const targetDay = weekMap[weekday];
        const date = new Date();
        const currentDay = date.getDay();
        const daysUntilTarget = (targetDay + 7 - currentDay) % 7 || 7;
        date.setDate(date.getDate() + daysUntilTarget);
        date.setHours(parseInt(hour), parseInt(minute), 0, 0);
        return this.formatDateTime(date);
    },
    
    // 获取本周/下周某天
    getWeekDay(prefix, weekday, hour, minute) {
        const weekMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };
        const targetDay = weekMap[weekday];
        const date = new Date();
        const currentDay = date.getDay();
        let daysUntilTarget = (targetDay - currentDay + 7) % 7;
        if (prefix && prefix.includes('下')) {
            daysUntilTarget += 7;
        } else if (daysUntilTarget === 0) {
            daysUntilTarget = 7;
        }
        date.setDate(date.getDate() + daysUntilTarget);
        date.setHours(parseInt(hour), parseInt(minute), 0, 0);
        return this.formatDateTime(date);
    },
    
    // 获取具体日期（带年份）
    getFullDate(year, month, day, hour, minute) {
        const date = new Date();
        date.setFullYear(parseInt(year), parseInt(month) - 1, parseInt(day));
        date.setHours(parseInt(hour), parseInt(minute), 0, 0);
        return this.formatDateTime(date);
    },
    
    // 获取具体日期
    getSpecificDate(month, day, hour, minute) {
        const date = new Date();
        date.setMonth(parseInt(month) - 1, parseInt(day));
        date.setHours(parseInt(hour), parseInt(minute), 0, 0);
        return this.formatDateTime(date);
    },
    
    // 获取短日期（月/日）
    getShortDate(month, day, hour, minute) {
        const date = new Date();
        date.setMonth(parseInt(month) - 1, parseInt(day));
        date.setHours(parseInt(hour), parseInt(minute), 0, 0);
        return this.formatDateTime(date);
    },
    
    // 格式化日期时间
    formatDateTime(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hour}:${minute}`;
    },
    
    // 解析时间
    parseTime(text) {
        for (const { pattern, handler } of this.TIME_PATTERNS) {
            const match = text.match(pattern);
            if (match) {
                return handler(match);
            }
        }
        return null;
    },
    
    // 判断分类
    detectCategory(text) {
        const lowerText = text.toLowerCase();
        let workScore = 0;
        let lifeScore = 0;
        
        this.WORK_KEYWORDS.forEach(keyword => {
            if (lowerText.includes(keyword)) workScore++;
        });
        
        this.LIFE_KEYWORDS.forEach(keyword => {
            if (lowerText.includes(keyword)) lifeScore++;
        });
        
        return workScore >= lifeScore ? 'work' : 'life';
    },
    
    // 检测标题类型 - 增强版
    detectTitleType(text, category) {
        const lowerText = text.toLowerCase();
        
        if (category === 'work') {
            if (/常委会|办公会|党委会|例会|周会|月会|会议|开会|讨论|汇报/.test(lowerText)) return 'meeting';
            if (/报告|总结|材料|提交|上交|报送|投稿|填报|汇总表|填写/.test(lowerText)) return 'report';
            if (/OA.*截止|截止.*OA|征求意见.*到期|征求意见/.test(lowerText)) return 'deadline';
            if (/截止|到期|deadline|期限|最后期限|延长至/.test(lowerText)) return 'deadline';
            if (/阅文|查阅文件|前往.*办公室/.test(lowerText)) return 'notice';
            if (/提醒|督促|通知.*及时/.test(lowerText)) return 'notice';
            return 'default';
        } else {
            if (/医院|看病|医生|复查|体检|牙医|理疗|针灸|推拿|按摩/.test(lowerText)) return 'medical';
            if (/聚会|聚餐|吃饭|约会|见面|朋友|生日/.test(lowerText)) return 'social';
            if (/健身|运动|瑜伽|跑步|游泳/.test(lowerText)) return 'fitness';
            return 'default';
        }
    },
    
    // 提取核心内容
    extractCoreContent(text) {
        // 去除时间相关文字
        let content = text
            .replace(/明天[上午下午晚上]*\s*\d+[点:：]\d*/, '')
            .replace(/后天[上午下午晚上]*\s*\d+[点:：]\d*/, '')
            .replace(/今天[上午下午晚上]*\s*\d+[点:：]\d*/, '')
            .replace(/下周[一二三四五六日][上午下午晚上]*\s*\d*[点:：]?\d*/, '')
            .replace(/周[一二三四五六日][上午下午晚上]*\s*\d*[点:：]?\d*/, '')
            .replace(/\d{4}年\d{1,2}月\d{1,2}[日号][上午下午晚上]*\s*\d*[点:：]?\d*/, '')
            .replace(/\d{1,2}月\d{1,2}[日号][上午下午晚上]*\s*\d*[点:：]?\d*/, '')
            .replace(/\d{4}[-/]\d{1,2}[-/]\d{1,2}[上午下午晚上]*\s*\d*[点:：]?\d*/, '')
            .replace(/\d{1,2}[-/]\d{1,2}[上午下午晚上]*\s*\d*[点:：]?\d*/, '')
            .replace(/[上午下午晚上]+/, '')
            .replace(/\d{1,2}[点:：]\d{2}/, '')
            .replace(/请|需要|要求|务必|必须|请尽快|请及时/g, '')
            .trim();
        
        return content;
    },
    
    // 提取关键名词（用于标题）- 增强版
    extractKeyNouns(text) {
        // 匹配常见名词模式 - 优先级从高到低
        const patterns = [
            // 提取《文件名》- 最高优先级
            /《([^》]{2,30})》/,
            // 提取会议名称：党委常委会/校长办公会/XX会议
            /([^，。,]{2,15})(?:常委会|办公会|党委会)/,
            // 投稿/征稿类：双百行动工作简报
            /([^，。,]{2,20})(?:工作简报|征稿|投稿)/,
            // OA征求意见
            /(\d{4}年[^，。,]{2,20})(?:工作要点|考核评价指标|征求意见)/,
            // 阅文通知：提取文件编号
            /阅文[（(]([^）)]{5,40})[)）]/,
            // 填报类：听课评价系统
            /([^，。,]{2,15})(?:评价系统|填报|系统)/,
            // 关于XX的...
            /(?:关于|针对|就)([^，。,]{2,10})(?:的|进行|开展|组织|安排)/,
            // XX会议/报告/材料
            /([^，。,]{2,8})(?:报告|材料|总结|计划|项目|任务)/,
            // 提交/报送XX
            /(?:提交|上报|报送|完成|填写)([^，。,]{2,15})(?:材料|报告|文档|文件|表|名单)/,
            // 前往XX地点
            /前往([^，。,]{2,10})(?:办公室|会议室|教室)/,
            // 体检/复查等
            /([^，。,]{2,6})(?:体检|复查|理疗|针灸|推拿)/,
            // 和朋友/XX吃饭
            /(?:和|与|跟)([^，。,]{2,8})(?:吃饭|聚餐|见面|约会)/
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        
        return null;
    },
    
    // 生成智能标题 - 增强版
    generateSmartTitle(text, category) {
        const titleType = this.detectTitleType(text, category);
        const templates = this.TITLE_TEMPLATES[category][titleType] || this.TITLE_TEMPLATES[category]['default'];
        const template = templates[Math.floor(Math.random() * templates.length)];
        
        // 尝试提取关键名词
        const keyNoun = this.extractKeyNouns(text);
        
        if (keyNoun) {
            // 有关键名词，组合成标题
            if (titleType === 'meeting') {
                // 如果已包含"会议"相关词，直接返回
                if (keyNoun.includes('会') || keyNoun.includes('常委会') || keyNoun.includes('办公会')) {
                    return keyNoun;
                }
                return `${keyNoun}会议`;
            } else if (titleType === 'report') {
                // 如果包含书名号，直接返回
                if (keyNoun.startsWith('《') && keyNoun.endsWith('》')) {
                    return `提交${keyNoun}`;
                }
                // 投稿类特殊处理
                if (text.includes('投稿') || text.includes('征稿')) {
                    return `${keyNoun}投稿`;
                }
                return `提交${keyNoun}`;
            } else if (titleType === 'deadline') {
                // OA征求意见特殊处理
                if (text.includes('OA') || text.includes('征求意见')) {
                    return `${keyNoun}征求意见`;
                }
                return `${keyNoun}截止`;
            } else if (titleType === 'notice') {
                if (text.includes('阅文')) {
                    return keyNoun ? `阅文：${keyNoun}` : '阅文通知';
                }
                return `${keyNoun || ''}通知`;
            } else if (titleType === 'medical') {
                return `${keyNoun}预约`;
            } else if (titleType === 'social') {
                return `与${keyNoun}聚会`;
            } else if (titleType === 'fitness') {
                return `${keyNoun}安排`;
            }
        }
        
        // 没有关键名词，使用模板
        return template;
    },
    
    // 提取标题（兼容旧方法）
    extractTitle(text) {
        return this.generateSmartTitle(text, this.detectCategory(text));
    },
    
    // 智能识别
    recognize(text) {
        const result = {
            title: this.extractTitle(text),
            category: this.detectCategory(text),
            deadline: this.parseTime(text),
            desc: text
        };
        
        return result;
    }
};

// UI 管理
const UI = {
    init() {
        this.updateDate();
        this.bindEvents();
        this.renderTasks();
        this.updateStats();
        this.renderIdeas();
        // 页面加载时自动从云端同步
        AutoSync.downloadOnLoad();
    },
    
    // 更新日期显示
    updateDate() {
        const now = new Date();
        const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const weekdayStr = weekdays[now.getDay()];
        
        document.getElementById('current-date').textContent = dateStr;
        document.getElementById('current-weekday').textContent = weekdayStr;
    },
    
    // 绑定事件
    bindEvents() {
        // Tab 切换
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            });
        });
        
        // 视图切换
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.switchView(view);
            });
        });
        
        // 刷新表格按钮
        document.getElementById('refresh-table-btn')?.addEventListener('click', () => {
            this.renderTable();
            this.showToast('表格已刷新');
        });
        
        // 文字识别
        document.getElementById('recognize-text-btn').addEventListener('click', () => {
            this.handleTextRecognize();
        });
        
        // 图片上传
        const uploadArea = document.getElementById('upload-area');
        const imageInput = document.getElementById('image-input');
        
        uploadArea.addEventListener('click', () => imageInput.click());
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--color-primary)';
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = '#E0D5CE';
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#E0D5CE';
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleImageUpload(files[0]);
            }
        });
        
        imageInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleImageUpload(e.target.files[0]);
            }
        });
        
        // 全局粘贴截图支持
        document.addEventListener('paste', (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            
            for (const item of items) {
                if (item.type.indexOf('image') !== -1) {
                    const blob = item.getAsFile();
                    if (blob) {
                        this.handleImageUpload(blob);
                        this.showToast('截图已粘贴');
                        // 切换到图片标签页
                        this.switchTab('image');
                    }
                    break;
                }
            }
        });
        
        // 识别结果表单
        document.getElementById('task-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveRecognizedTask();
        });
        
        document.getElementById('cancel-btn').addEventListener('click', () => {
            this.hideFormSection();
        });
        
        // 弹窗
        document.getElementById('modal-close').addEventListener('click', () => {
            this.closeModal();
        });
        
        document.getElementById('modal-cancel').addEventListener('click', () => {
            this.closeModal();
        });
        
        document.getElementById('modal-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveModalTask();
        });
        
        // 添加按钮（工作/生活区）
        document.querySelectorAll('.add-btn[data-category]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.currentTarget.dataset.category;
                this.openModal(null, category);
            });
        });
        
        document.getElementById('fab-add').addEventListener('click', () => {
            this.openModal();
        });
        
        // 奇思妙想按钮
        const addIdeaBtn = document.getElementById('add-idea-btn');
        if (addIdeaBtn) {
            addIdeaBtn.addEventListener('click', () => {
                this.openIdeaModal();
            });
        }
        
        // 奇思妙想弹窗事件
        const ideaModalClose = document.getElementById('idea-modal-close');
        const ideaModalCancel = document.getElementById('idea-modal-cancel');
        const ideaModalOverlay = document.getElementById('idea-modal-overlay');
        const ideaForm = document.getElementById('idea-form');
        
        if (ideaModalClose) {
            ideaModalClose.addEventListener('click', () => this.closeIdeaModal());
        }
        if (ideaModalCancel) {
            ideaModalCancel.addEventListener('click', () => this.closeIdeaModal());
        }
        if (ideaModalOverlay) {
            ideaModalOverlay.addEventListener('click', (e) => {
                if (e.target.id === 'idea-modal-overlay') {
                    this.closeIdeaModal();
                }
            });
        }
        if (ideaForm) {
            ideaForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveIdea();
            });
        }
        
        // 点击遮罩关闭弹窗
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'modal-overlay') {
                this.closeModal();
            }
        });

        // 数据备份功能
        this.bindBackupEvents();

        // 时间启用/禁用切换（识别结果表单）
        const timeToggle = document.getElementById('has-time');
        const timeInput = document.getElementById('task-time');
        if (timeToggle && timeInput) {
            timeToggle.addEventListener('change', (e) => {
                timeInput.disabled = !e.target.checked;
                timeInput.style.opacity = e.target.checked ? '1' : '0.5';
                if (e.target.checked && !timeInput.value) {
                    timeInput.value = '09:00';
                }
            });
        }
        
        // 弹窗中的时间启用/禁用切换
        const modalTimeToggle = document.getElementById('modal-has-time');
        const modalTimeInput = document.getElementById('modal-task-time');
        if (modalTimeToggle && modalTimeInput) {
            modalTimeToggle.addEventListener('change', (e) => {
                modalTimeInput.disabled = !e.target.checked;
                modalTimeInput.style.opacity = e.target.checked ? '1' : '0.5';
                if (e.target.checked && !modalTimeInput.value) {
                    modalTimeInput.value = '09:00';
                }
            });
        }
    },
    
    // 切换 Tab
    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tab}-tab`);
        });
    },
    
    // 切换视图
    switchView(view) {
        // 更新按钮状态
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        // 切换显示内容
        const cardView = document.getElementById('card-view');
        const tableView = document.getElementById('table-view');
        
        if (view === 'card') {
            cardView.style.display = 'block';
            tableView.style.display = 'none';
        } else {
            cardView.style.display = 'none';
            tableView.style.display = 'block';
            this.renderTable();
        }
    },
    
    // 渲染 A5 表格
    renderTable() {
        const tasks = Storage.getAll();
        const tbody = document.getElementById('a5-table-body');
        const dateEl = document.getElementById('table-date');
        const statsEl = document.getElementById('a5-stats');
        
        // 更新日期
        const now = new Date();
        dateEl.textContent = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
        
        // 按截止时间排序
        tasks.sort((a, b) => {
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline) - new Date(b.deadline);
        });
        
        // 清空表格
        tbody.innerHTML = '';
        
        if (tasks.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 20px; color: var(--color-text-muted);">
                        暂无日程，快去添加吧～
                    </td>
                </tr>
            `;
            statsEl.textContent = '0 项';
            return;
        }
        
        // 渲染表格行
        tasks.forEach(task => {
            const tr = document.createElement('tr');
            
            // 时间格式化
            const timeText = task.deadline ? this.formatTableTime(task.deadline, task.hasTime === true) : '-';
            const isUrgent = task.deadline && this.isUrgent(task.deadline);
            
            // 分类图标
            const categoryIcon = task.category === 'work' ? '💼' : '🏠';
            
            tr.innerHTML = `
                <td class="col-status">
                    <span class="status-checkbox ${task.completed ? 'checked' : ''}"></span>
                </td>
                <td class="col-time">
                    <span class="time-text ${isUrgent ? 'urgent' : ''}">${timeText}</span>
                </td>
                <td class="col-title">
                    <span class="title-text ${task.completed ? 'completed' : ''}">${this.escapeHtml(task.title)}</span>
                </td>
                <td class="col-category">
                    <span class="category-badge ${task.category}">${categoryIcon}</span>
                </td>
            `;
            
            tbody.appendChild(tr);
        });
        
        // 更新统计
        const completedCount = tasks.filter(t => t.completed).length;
        statsEl.textContent = `${tasks.length} 项 (${completedCount} 完成)`;
    },
    
    // 格式化表格时间（简化版）
    formatTableTime(deadline, hasTime = true) {
        if (!deadline) return '-';
        
        // 直接从字符串解析日期，避免时区问题
        // deadline 格式: "2026-04-16T00:00:00"
        const [datePart, timePart] = deadline.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute] = timePart ? timePart.split(':').map(Number) : [0, 0];
        
        const timeStr = hasTime ? ` ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` : '';
        
        return `${year}年${month}月${day}日${timeStr}`;
    },
    
    // 处理文字识别
    handleTextRecognize() {
        const input = document.getElementById('recognize-input');
        const text = input.value.trim();
        
        if (!text) {
            this.showToast('请输入需要识别的文字');
            return;
        }
        
        const result = SmartRecognizer.recognize(text);
        this.fillForm(result);
        this.showFormSection();
        input.value = '';
    },
    
    // 处理图片上传
    handleImageUpload(file) {
        // 预览图片
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('image-preview');
            preview.innerHTML = `<img src="${e.target.result}" alt="预览">`;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
        
        // 模拟图片识别（实际项目中需要接入OCR API）
        this.showToast('图片已上传，请输入相关文字进行识别');
        this.switchTab('text');
        
        // 提示用户输入
        const input = document.getElementById('recognize-input');
        input.placeholder = '请描述图片中的日程信息...';
        input.focus();
    },
    
    // 填充表单
    fillForm(data) {
        document.getElementById('task-title').value = data.title || '';
        document.getElementById('task-category').value = data.category || 'work';
        document.getElementById('task-desc').value = data.desc || '';
        
        // 分离日期和时间
        if (data.deadline) {
            // 直接从字符串提取，避免时区问题
            // deadline 格式: "2026-04-16T14:30:00"
            const [dateStr, timeFull] = data.deadline.split('T');
            const timeStr = timeFull ? timeFull.substring(0, 5) : '09:00';
            
            document.getElementById('task-date').value = dateStr;
            document.getElementById('task-time').value = timeStr;
            document.getElementById('has-time').checked = true;
            document.getElementById('task-time').disabled = false;
            document.getElementById('task-time').style.opacity = '1';
        } else {
            // 默认今天
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('task-date').value = today;
            document.getElementById('task-time').value = '';
            document.getElementById('has-time').checked = false;
            document.getElementById('task-time').disabled = true;
            document.getElementById('task-time').style.opacity = '0.5';
        }
    },
    
    // 显示表单区域
    showFormSection() {
        document.getElementById('form-section').style.display = 'block';
        document.getElementById('form-section').scrollIntoView({ behavior: 'smooth' });
    },
    
    // 隐藏表单区域
    hideFormSection() {
        document.getElementById('form-section').style.display = 'none';
        document.getElementById('task-form').reset();
    },
    
    // 保存识别的任务
    saveRecognizedTask() {
        const dateVal = document.getElementById('task-date').value;
        const hasTime = document.getElementById('has-time').checked;
        const timeVal = hasTime ? document.getElementById('task-time').value : '00:00';
        
        let deadline = null;
        if (dateVal) {
            deadline = `${dateVal}T${timeVal}:00`;
        }
        
        const task = {
            title: document.getElementById('task-title').value,
            category: document.getElementById('task-category').value,
            deadline: deadline,
            hasTime: hasTime && dateVal, // 记录是否设置了时间
            desc: document.getElementById('task-desc').value
        };
        
        if (!task.title) {
            this.showToast('请输入标题');
            return;
        }
        
        if (!dateVal) {
            this.showToast('请选择日期');
            return;
        }
        
        Storage.add(task);
        this.hideFormSection();
        this.renderTasks();
        this.updateStats();
        this.showToast('日程已保存');
    },
    
    // 渲染任务列表
    renderTasks() {
        const tasks = Storage.getAll();
        const workList = document.getElementById('work-list');
        const lifeList = document.getElementById('life-list');
        
        // 更新调试信息
        this.updateDebugInfo();
        
        // 清空列表
        workList.innerHTML = '';
        lifeList.innerHTML = '';
        
        // 按截止时间排序
        tasks.sort((a, b) => {
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline) - new Date(b.deadline);
        });
        
        // 分离工作/生活
        const workTasks = tasks.filter(t => t.category === 'work');
        const lifeTasks = tasks.filter(t => t.category === 'life');
        
        // 渲染工作列表
        if (workTasks.length === 0) {
            workList.innerHTML = this.getEmptyState('💼', '暂无工作事项');
        } else {
            workTasks.forEach(task => {
                workList.appendChild(this.createTaskElement(task));
            });
        }
        
        // 渲染生活列表
        if (lifeTasks.length === 0) {
            lifeList.innerHTML = this.getEmptyState('🏠', '暂无生活事项');
        } else {
            lifeTasks.forEach(task => {
                lifeList.appendChild(this.createTaskElement(task));
            });
        }
    },
    
    // 获取空状态
    getEmptyState(icon, text) {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">${icon}</div>
                <div class="empty-state-text">${text}</div>
            </div>
        `;
    },
    
    // 创建任务元素
    createTaskElement(task) {
        const div = document.createElement('div');
        div.className = `task-item ${task.category} ${task.completed ? 'completed' : ''}`;
        div.dataset.id = task.id;
        
        // 直接内联时间格式化，避免函数调用问题
        let timeText = '无截止时间';
        if (task.deadline) {
            const [datePart, timeFull] = task.deadline.split('T');
            const [y, m, d] = datePart.split('-');
            const hasTime = task.hasTime === true;
            const timeStr = hasTime && timeFull ? ` ${timeFull.substring(0, 5)}` : '';
            timeText = `${y}年${m}月${d}日${timeStr}`;
        }
        const isUrgent = task.deadline && this.isUrgent(task.deadline);
        
        div.innerHTML = `
            <div class="task-header">
                <span class="task-title">${this.escapeHtml(task.title)}</span>
                <div class="task-checkbox ${task.completed ? 'checked' : ''}" onclick="UI.toggleComplete('${task.id}', event)"></div>
            </div>
            <div class="task-meta">
                <span class="task-time ${isUrgent ? 'urgent' : ''}">⏰ ${timeText}</span>
            </div>
            ${task.desc ? `<div class="task-desc">${this.escapeHtml(task.desc)}</div>` : ''}
            <div class="task-actions">
                <button class="task-action-btn edit" onclick="UI.editTask('${task.id}', event)">编辑</button>
                <button class="task-action-btn delete" onclick="UI.deleteTask('${task.id}', event)">删除</button>
            </div>
        `;
        
        return div;
    },
    
    // 格式化截止时间
    formatDeadline(deadline, hasTime = true) {
        if (!deadline) return '无截止时间';
        
        // 直接从字符串解析日期，避免时区问题
        // deadline 格式: "2026-04-16T00:00:00"
        const [datePart, timePart] = deadline.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute] = timePart ? timePart.split(':').map(Number) : [0, 0];
        
        const timeStr = hasTime ? ` ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` : '';
        
        return `${year}年${month}月${day}日${timeStr}`;
    },
    
    // 判断是否紧急（24小时内）
    isUrgent(deadline) {
        if (!deadline) return false;
        
        // 直接从字符串解析日期，避免时区问题
        const [datePart, timePart] = deadline.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute] = timePart ? timePart.split(':').map(Number) : [0, 0];
        
        const date = new Date(year, month - 1, day, hour, minute);
        const now = new Date();
        const diff = date - now;
        return diff > 0 && diff < 24 * 60 * 60 * 1000;
    },
    
    // 转义HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    // 切换完成状态
    toggleComplete(id, event) {
        event.stopPropagation();
        const completed = Storage.toggleComplete(id);
        this.renderTasks();
        this.updateStats();
        
        if (completed) {
            this.showToast('已完成 ✓');
        }
    },
    
    // 编辑任务
    editTask(id, event) {
        event.stopPropagation();
        const tasks = Storage.getAll();
        const task = tasks.find(t => t.id === id);
        if (task) {
            this.openModal(task);
        }
    },
    
    // 删除任务
    deleteTask(id, event) {
        event.stopPropagation();
        if (confirm('确定要删除这个日程吗？')) {
            Storage.delete(id);
            this.renderTasks();
            this.updateStats();
            this.showToast('已删除');
        }
    },
    
    // 更新统计（统计面板已删除，此函数保留但不再更新DOM）
    updateStats() {
        // 统计面板已移除，此函数保留用于兼容性
        // 如需重新启用统计，取消下面注释并恢复HTML中的统计面板
        // const tasks = Storage.getAll();
        // const workCount = tasks.filter(t => t.category === 'work' && !t.completed).length;
        // const lifeCount = tasks.filter(t => t.category === 'life' && !t.completed).length;
        // const workEl = document.getElementById('work-count');
        // const lifeEl = document.getElementById('life-count');
        // if (workEl) workEl.textContent = workCount;
        // if (lifeEl) lifeEl.textContent = lifeCount;
    },
    
    // 打开弹窗
    openModal(task = null, defaultCategory = 'work') {
        const modal = document.getElementById('modal-overlay');
        const title = document.getElementById('modal-title');
        
        if (task) {
            title.textContent = '编辑日程';
            document.getElementById('modal-task-id').value = task.id;
            document.getElementById('modal-task-title').value = task.title;
            document.getElementById('modal-task-category').value = task.category;
            document.getElementById('modal-task-desc').value = task.desc || '';
            
            // 分离日期和时间
            if (task.deadline) {
                // 从 deadline 字符串直接提取日期和时间（避免时区问题）
                // deadline 格式: "2026-04-16T00:00:00" 或 "2026-04-16T14:30:00"
                const [dateStr, timeFull] = task.deadline.split('T');
                const timeStr = timeFull ? timeFull.substring(0, 5) : '00:00'; // 提取 HH:MM
                
                document.getElementById('modal-task-date').value = dateStr;
                document.getElementById('modal-task-time').value = timeStr;
                // 根据 hasTime 字段设置时间复选框
                const hasTimeChecked = task.hasTime === true; // 只有明确为 true 才勾选
                document.getElementById('modal-has-time').checked = hasTimeChecked;
                document.getElementById('modal-task-time').disabled = !hasTimeChecked;
                document.getElementById('modal-task-time').style.opacity = hasTimeChecked ? '1' : '0.5';
            } else {
                const today = new Date().toISOString().split('T')[0];
                document.getElementById('modal-task-date').value = today;
                document.getElementById('modal-task-time').value = '';
                document.getElementById('modal-has-time').checked = false;
                document.getElementById('modal-task-time').disabled = true;
                document.getElementById('modal-task-time').style.opacity = '0.5';
            }
        } else {
            title.textContent = '新建日程';
            document.getElementById('modal-form').reset();
            document.getElementById('modal-task-id').value = '';
            document.getElementById('modal-task-category').value = defaultCategory;
            
            // 默认今天
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('modal-task-date').value = today;
            document.getElementById('modal-task-time').value = '';
            document.getElementById('modal-has-time').checked = false;
            document.getElementById('modal-task-time').disabled = true;
            document.getElementById('modal-task-time').style.opacity = '0.5';
        }
        
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    },

    // 关闭弹窗
    closeModal() {
        const modal = document.getElementById('modal-overlay');
        modal.classList.remove('show');
        document.body.style.overflow = '';
    },
    
    // 保存弹窗任务
    saveModalTask() {
        const id = document.getElementById('modal-task-id').value;
        const dateVal = document.getElementById('modal-task-date').value;
        const hasTime = document.getElementById('modal-has-time').checked;
        const timeVal = hasTime ? document.getElementById('modal-task-time').value : '00:00';
        
        let deadline = null;
        if (dateVal) {
            deadline = `${dateVal}T${timeVal}:00`;
        }
        
        const task = {
            title: document.getElementById('modal-task-title').value,
            category: document.getElementById('modal-task-category').value,
            deadline: deadline,
            hasTime: hasTime && dateVal, // 记录是否设置了时间
            desc: document.getElementById('modal-task-desc').value
        };
        
        if (!task.title) {
            this.showToast('请输入标题');
            return;
        }
        
        if (!dateVal) {
            this.showToast('请选择日期');
            return;
        }
        
        if (id) {
            Storage.update(id, task);
            this.showToast('日程已更新');
        } else {
            Storage.add(task);
            this.showToast('日程已添加');
        }
        
        this.closeModal();
        this.renderTasks();
        this.updateStats();
        
        // 如果表格视图打开，也刷新表格
        const tableView = document.getElementById('table-view');
        if (tableView && tableView.style.display === 'block') {
            this.renderTable();
        }
    },
    
    // 显示提示
    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2500);
    },
    
    // 显示同步成功指示器
    showSyncIndicator() {
        const btn = document.getElementById('gist-sync-btn');
        if (!btn) return;
        
        const original = btn.textContent;
        btn.textContent = '✓';
        btn.style.color = '#28a745';
        
        setTimeout(() => {
            btn.textContent = original;
            btn.style.color = '';
        }, 2000);
    },
    
    // ========== 奇思妙想功能 ==========
    
    // 渲染奇思妙想列表
    renderIdeas() {
        const ideasList = document.getElementById('ideas-list');
        if (!ideasList) return;
        
        const ideas = IdeasStorage.getAll();
        ideasList.innerHTML = '';
        
        if (ideas.length === 0) {
            ideasList.innerHTML = `
                <div class="idea-empty">
                    <div class="idea-empty-icon">💡</div>
                    <div>点击右上角 + 记录你的奇思妙想</div>
                </div>
            `;
            return;
        }
        
        ideas.forEach(idea => {
            ideasList.appendChild(this.createIdeaElement(idea));
        });
    },
    
    // 创建奇思妙想元素
    createIdeaElement(idea) {
        const div = document.createElement('div');
        div.className = 'idea-item';
        div.dataset.id = idea.id;
        
        const date = new Date(idea.createdAt);
        const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;
        
        const tagsHtml = idea.tags ? idea.tags.split(/\s+/).filter(t => t).map(tag => 
            `<span class="idea-tag">${this.escapeHtml(tag)}</span>`
        ).join('') : '';
        
        div.innerHTML = `
            <div class="idea-content">${this.escapeHtml(idea.content)}</div>
            <div class="idea-meta">
                <div class="idea-tags">${tagsHtml}</div>
                <span class="idea-date">${dateStr}</span>
            </div>
            <div class="idea-actions">
                <button onclick="UI.editIdea('${idea.id}', event)" title="编辑">✏️</button>
                <button onclick="UI.deleteIdea('${idea.id}', event)" title="删除">🗑️</button>
            </div>
        `;
        
        return div;
    },
    
    // 打开奇思妙想弹窗
    openIdeaModal(idea = null) {
        const modal = document.getElementById('idea-modal-overlay');
        const title = document.getElementById('idea-modal-title');
        
        if (idea) {
            title.textContent = '编辑奇思妙想';
            document.getElementById('idea-id').value = idea.id;
            document.getElementById('idea-content').value = idea.content;
            document.getElementById('idea-tags').value = idea.tags || '';
        } else {
            title.textContent = '记录奇思妙想';
            document.getElementById('idea-form').reset();
            document.getElementById('idea-id').value = '';
        }
        
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        document.getElementById('idea-content').focus();
    },

    // 关闭奇思妙想弹窗
    closeIdeaModal() {
        const modal = document.getElementById('idea-modal-overlay');
        modal.classList.remove('show');
        document.body.style.overflow = '';
    },
    
    // 保存奇思妙想
    saveIdea() {
        const id = document.getElementById('idea-id').value;
        const content = document.getElementById('idea-content').value.trim();
        const tags = document.getElementById('idea-tags').value.trim();
        
        if (!content) {
            this.showToast('请输入内容');
            return;
        }
        
        const idea = { content, tags };
        
        if (id) {
            IdeasStorage.update(id, idea);
            this.showToast('已更新');
        } else {
            IdeasStorage.add(idea);
            this.showToast('已记录');
        }
        
        this.closeIdeaModal();
        this.renderIdeas();
    },
    
    // 编辑奇思妙想
    editIdea(id, event) {
        event.stopPropagation();
        const ideas = IdeasStorage.getAll();
        const idea = ideas.find(i => i.id === id);
        if (idea) {
            this.openIdeaModal(idea);
        }
    },
    
    // 删除奇思妙想
    deleteIdea(id, event) {
        event.stopPropagation();
        if (confirm('确定要删除这条记录吗？')) {
            IdeasStorage.delete(id);
            this.renderIdeas();
            this.showToast('已删除');
        }
    },

    // ========== 数据备份功能 ==========
    bindBackupEvents() {
        // 打开备份弹窗
        document.getElementById('backup-btn')?.addEventListener('click', () => {
            this.openBackupModal();
        });

        // 调试按钮
        document.getElementById('debug-btn')?.addEventListener('click', () => {
            this.toggleDebugMode();
        });

        // 关闭备份弹窗
        document.getElementById('backup-modal-close')?.addEventListener('click', () => {
            this.closeBackupModal();
        });

        // 点击遮罩关闭
        document.getElementById('backup-modal-overlay')?.addEventListener('click', (e) => {
            if (e.target.id === 'backup-modal-overlay') {
                this.closeBackupModal();
            }
        });

        // 导出数据
        document.getElementById('export-data-btn')?.addEventListener('click', () => {
            this.exportData();
        });

        // 导入数据
        document.getElementById('import-data-btn')?.addEventListener('click', () => {
            document.getElementById('import-file-input')?.click();
        });

        // 文件选择后导入
        document.getElementById('import-file-input')?.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.importData(e.target.files[0]);
            }
        });
    },

    // 打开备份弹窗
    openBackupModal() {
        const modal = document.getElementById('backup-modal-overlay');
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    },

    // 关闭备份弹窗
    closeBackupModal() {
        const modal = document.getElementById('backup-modal-overlay');
        modal.classList.remove('show');
        document.body.style.overflow = '';
    },

    // 导出数据
    exportData() {
        const data = {
            tasks: Storage.getAll(),
            ideas: IdeasStorage.getAll(),
            exportTime: new Date().toISOString(),
            version: '1.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `小爱酱账备份_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('数据已导出');
        this.closeBackupModal();
    },

    // 导入数据
    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (!confirm('导入数据将覆盖当前所有数据，确定继续吗？')) {
                    return;
                }

                // 导入任务
                if (data.tasks && Array.isArray(data.tasks)) {
                    Storage.save(data.tasks);
                }

                // 导入奇思妙想
                if (data.ideas && Array.isArray(data.ideas)) {
                    IdeasStorage.save(data.ideas);
                }

                // 刷新显示
                this.renderTasks();
                this.renderIdeas();
                this.updateStats();

                this.showToast('数据导入成功');
                this.closeBackupModal();
            } catch (err) {
                this.showToast('文件格式错误，导入失败');
                console.error('导入错误:', err);
            }
        };
        reader.readAsText(file);
    },

    // ========== GitHub Gist 同步功能 ==========
    bindGistSyncEvents() {
        // 打开同步设置
        document.getElementById('gist-sync-btn')?.addEventListener('click', () => {
            this.openGistModal();
        });

        // 调试模式开关
        this.debugMode = false;
    },

    // 切换调试模式
    toggleDebugMode() {
        this.debugMode = !this.debugMode;
        const panel = document.getElementById('debug-panel');
        if (this.debugMode) {
            panel.style.display = 'block';
            this.updateDebugInfo();
            this.showToast('调试模式已开启');
        } else {
            panel.style.display = 'none';
            this.showToast('调试模式已关闭');
        }
    },

    // 更新调试信息
    updateDebugInfo() {
        if (!this.debugMode) return;
        const tasks = Storage.getAll();
        const debugContent = tasks.map(t => {
            return `ID: ${t.id}\n标题: ${t.title}\ndeadline: ${t.deadline}\nhasTime: ${t.hasTime}\n显示: ${t.deadline ? this.formatDeadline(t.deadline, t.hasTime === true) : '无'}\n---`;
        }).join('\n');
        document.getElementById('debug-content').textContent = debugContent || '暂无任务';
    },

    // ========== Gist 同步功能 ==========
    bindGistEvents() {
        const self = this;
        
        // 关闭同步弹窗
        document.getElementById('gist-modal-close')?.addEventListener('click', function() {
            self.closeGistModal();
        });

        // 点击遮罩关闭
        document.getElementById('gist-modal-overlay')?.addEventListener('click', function(e) {
            if (e.target.id === 'gist-modal-overlay') {
                self.closeGistModal();
            }
        });

        // 保存设置
        document.getElementById('save-gist-settings')?.addEventListener('click', async function() {
            await self.saveGistSettings();
        });

        // 上传数据到 Gist
        document.getElementById('upload-to-gist')?.addEventListener('click', function() {
            self.uploadToGist();
        });

        // 从 Gist 下载数据
        document.getElementById('download-from-gist')?.addEventListener('click', function() {
            self.downloadFromGist();
        });
    },

    // 打开 Gist 同步弹窗
    openGistModal() {
        const modal = document.getElementById('gist-modal-overlay');
        const settings = this.getGistSettings();

        document.getElementById('gist-token').value = settings.token || '';
        document.getElementById('gist-id').value = settings.gistId || '';

        this.updateGistStatus();
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    },

    // 关闭 Gist 同步弹窗
    closeGistModal() {
        const modal = document.getElementById('gist-modal-overlay');
        modal.classList.remove('show');
        document.body.style.overflow = '';
    },

    // 获取 Gist 设置
    getGistSettings() {
        const settings = localStorage.getItem('gist-settings');
        return settings ? JSON.parse(settings) : {};
    },

    // 保存 Gist 设置
    async saveGistSettings() {
        const token = document.getElementById('gist-token').value.trim();
        let gistId = document.getElementById('gist-id').value.trim();

        if (!token) {
            this.showToast('请输入 GitHub Token');
            return;
        }

        // 如果没有 Gist ID，自动创建一个新的
        if (!gistId) {
            try {
                this.showToast('正在创建 Gist...');
                
                const data = {
                    tasks: Storage.getAll(),
                    ideas: IdeasStorage.getAll(),
                    syncTime: new Date().toISOString(),
                    version: '1.0'
                };

                const body = {
                    description: '小爱酱账数据备份',
                    public: false,
                    files: {
                        'xiaoaizhang-data.json': {
                            content: JSON.stringify(data, null, 2)
                        }
                    }
                };

                const response = await fetch('https://api.github.com/gists', {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || '创建失败');
                }

                const result = await response.json();
                gistId = result.id;
                
                // 更新输入框
                document.getElementById('gist-id').value = gistId;
                this.showToast(`创建成功！Gist ID: ${gistId}`);
            } catch (err) {
                this.showToast('创建 Gist 失败: ' + err.message);
                console.error('创建 Gist 错误:', err);
                return;
            }
        }

        const settings = { token, gistId };
        localStorage.setItem('gist-settings', JSON.stringify(settings));
        this.showToast('设置已保存');
        this.updateGistStatus();
    },

    // 更新同步状态显示
    updateGistStatus() {
        const settings = this.getGistSettings();
        const statusEl = document.getElementById('gist-status');

        if (!settings.token) {
            statusEl.textContent = '未配置';
            statusEl.style.color = '#999';
        } else if (settings.gistId) {
            statusEl.textContent = '已配置 Gist ID';
            statusEl.style.color = '#28a745';
        } else {
            statusEl.textContent = 'Token 已保存，需创建 Gist';
            statusEl.style.color = '#ffc107';
        }
    },

    // 上传数据到 Gist
    async uploadToGist() {
        const settings = this.getGistSettings();
        if (!settings.token) {
            this.showToast('请先配置 GitHub Token');
            return;
        }

        const data = {
            tasks: Storage.getAll(),
            ideas: IdeasStorage.getAll(),
            syncTime: new Date().toISOString(),
            version: '1.0'
        };

        try {
            this.showToast('正在上传...');

            const body = {
                description: '小爱酱账数据备份',
                public: false,
                files: {
                    'xiaoaizhang-data.json': {
                        content: JSON.stringify(data, null, 2)
                    }
                }
            };

            let url = 'https://api.github.com/gists';
            let method = 'POST';

            // 如果已有 Gist ID，则更新
            if (settings.gistId) {
                url = `https://api.github.com/gists/${settings.gistId}`;
                method = 'PATCH';
            }

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `token ${settings.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || '上传失败');
            }

            const result = await response.json();

            // 保存 Gist ID
            if (!settings.gistId) {
                settings.gistId = result.id;
                localStorage.setItem('gist-settings', JSON.stringify(settings));
                document.getElementById('gist-id').value = result.id;
                this.updateGistStatus();
            }

            this.showToast(`上传成功！${new Date().toLocaleString()}`);
        } catch (err) {
            this.showToast('上传失败: ' + err.message);
            console.error('Gist 上传错误:', err);
        }
    },

    // 从 Gist 下载数据
    async downloadFromGist() {
        const settings = this.getGistSettings();
        if (!settings.token || !settings.gistId) {
            this.showToast('请先配置 Token 和 Gist ID');
            return;
        }

        try {
            this.showToast('正在下载...');

            const response = await fetch(`https://api.github.com/gists/${settings.gistId}`, {
                headers: {
                    'Authorization': `token ${settings.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error('下载失败');
            }

            const result = await response.json();
            const fileContent = result.files['xiaoaizhang-data.json']?.content;

            if (!fileContent) {
                throw new Error('未找到数据文件');
            }

            const data = JSON.parse(fileContent);

            if (!confirm(`确定要覆盖当前数据吗？\n云端数据时间: ${new Date(data.syncTime).toLocaleString()}`)) {
                return;
            }

            // 导入数据
            if (data.tasks && Array.isArray(data.tasks)) {
                Storage.save(data.tasks);
            }
            if (data.ideas && Array.isArray(data.ideas)) {
                IdeasStorage.save(data.ideas);
            }

            // 刷新显示
            this.renderTasks();
            this.renderIdeas();
            this.updateStats();

            this.showToast('数据同步成功！');
            this.closeGistModal();
        } catch (err) {
            this.showToast('下载失败: ' + err.message);
            console.error('Gist 下载错误:', err);
        }
    }
};

// 全局错误捕获
window.onerror = function(msg, url, line, col, error) {
    console.error('全局错误:', msg, '行:', line, '列:', col);
    alert('JS错误: ' + msg + ' (行:' + line + ')');
    return false;
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('开始初始化...');
        UI.init();
        UI.bindBackupEvents();
        UI.bindGistSyncEvents();
        UI.bindGistEvents();
        console.log('初始化完成');
    } catch (e) {
        console.error('初始化错误:', e);
        alert('初始化错误: ' + e.message);
    }
});

// 注册 Service Worker（PWA支持）- 可选功能
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // 检查 sw.js 是否存在
        fetch('sw.js', { method: 'HEAD' })
            .then(response => {
                if (response.ok) {
                    navigator.serviceWorker.register('sw.js')
                        .then(registration => {
                            console.log('SW registered:', registration);
                        })
                        .catch(error => {
                            console.log('SW registration failed:', error);
                        });
                } else {
                    console.log('sw.js not found, skipping PWA registration');
                }
            })
            .catch(() => {
                console.log('sw.js not found, skipping PWA registration');
            });
    });
}
