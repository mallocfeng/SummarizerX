# SummarizerX AI Reader - 国际化功能说明

## 概述

SummarizerX AI Reader 现已支持中英文双语界面，用户可以在设置页面中切换语言，所有界面文本都会相应更新。

## 功能特性

### 🌍 双语支持
- **中文（默认）**：完整的中文界面
- **English**：完整的英文界面
- **实时切换**：无需重启扩展，即时生效

### 🎨 界面覆盖
- ✅ 设置页面（options.html）
- ✅ 浮窗面板（float_panel.js）
- ✅ 翻译气泡（selection_translate.js）
- ✅ 扩展图标标题
- ✅ 错误提示和状态信息

## 使用方法

### 1. 语言切换
1. 打开扩展设置页面
2. 在页面顶部找到语言切换器（中文/English）
3. 点击对应语言按钮即可切换

### 2. 语言设置保存
- 语言选择会自动保存到浏览器存储
- 下次打开设置页面时会记住上次选择的语言
- 所有页面都会同步使用相同的语言设置

## 技术实现

### 文件结构
```
├── i18n.js              # 国际化配置文件
├── options.html         # 设置页面（已更新）
├── options.js           # 设置页面逻辑（已更新）
├── float_panel.js       # 浮窗面板（已更新）
├── selection_translate.js # 翻译气泡（已更新）
└── manifest.json        # 扩展配置（已更新）
```

### 核心组件

#### i18n.js
- 包含所有中英文文本配置
- 提供语言获取和文本翻译函数
- 支持嵌套键值访问（如 `settings.title`）

#### 主要函数
```javascript
// 获取当前语言
await getCurrentLanguage() // 返回 'zh' 或 'en'

// 获取翻译文本
await t('settings.title') // 返回当前语言的标题文本

// 同步获取翻译文本
tSync('settings.title', 'en') // 返回指定语言的文本

// 更新页面语言属性
await updatePageLanguage()
```

### 语言切换流程
1. 用户点击语言切换按钮
2. 保存语言设置到 `chrome.storage.sync`
3. 更新页面语言属性
4. 重新渲染所有界面文本
5. 更新语言切换器状态

## 添加新文本

### 1. 在 i18n.js 中添加文本
```javascript
const I18N = {
  zh: {
    newSection: {
      newKey: "中文文本"
    }
  },
  en: {
    newSection: {
      newKey: "English text"
    }
  }
};
```

### 2. 在代码中使用
```javascript
// 异步方式
const text = await t('newSection.newKey');

// 同步方式
const text = tSync('newSection.newKey', 'zh');
```

### 3. 更新界面
```javascript
// 在 updateUIText 函数中添加
updateElementText('element-id', await t('newSection.newKey'));
```

## 测试

### 测试页面
运行 `test_i18n.html` 可以预览国际化效果：
1. 打开测试页面
2. 点击语言切换按钮
3. 观察文本变化

### 功能测试
1. 在设置页面切换语言
2. 检查所有文本是否正确更新
3. 刷新页面确认设置保存
4. 测试浮窗面板和翻译气泡的语言显示

## 注意事项

### 兼容性
- 需要 Chrome 88+ 支持 ES6 模块
- 使用 `chrome.storage.sync` 保存设置
- 支持动态导入国际化模块

### 性能
- 国际化模块按需加载
- 文本缓存避免重复翻译
- 异步操作不阻塞界面

### 扩展性
- 易于添加新语言
- 支持复杂的嵌套文本结构
- 模块化设计便于维护

## 故障排除

### 常见问题

1. **文本未更新**
   - 检查元素ID是否正确
   - 确认国际化函数调用
   - 查看控制台错误信息

2. **语言设置丢失**
   - 检查存储权限
   - 确认 `chrome.storage.sync` 可用
   - 验证存储键名正确

3. **模块加载失败**
   - 确认 `i18n.js` 文件存在
   - 检查 manifest.json 配置
   - 验证模块导入路径

### 调试方法
```javascript
// 检查当前语言
console.log(await getCurrentLanguage());

// 测试文本翻译
console.log(await t('settings.title'));

// 查看存储内容
chrome.storage.sync.get(['ui_language'], console.log);
```

## 更新日志

### v1.6.6.0
- ✨ 新增中英文双语支持
- 🎨 添加语言切换器UI
- 🔧 重构国际化架构
- 📝 完善文档和测试

---

如有问题或建议，请提交 Issue 或 Pull Request。
