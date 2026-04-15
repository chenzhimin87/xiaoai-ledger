# 小爱酱账 GitHub Pages 部署指南

## 方法一：手动上传（推荐，最简单）

### 步骤 1：创建仓库
1. 打开 https://github.com/new
2. 仓库名填写：`xiaoai-ledger`
3. 描述填写：`小爱酱账 - 智能电子手账`
4. 选择 **Public**（公开）
5. 勾选 **Add a README file**
6. 点击 **Create repository**

### 步骤 2：上传文件
1. 进入刚创建的仓库页面
2. 点击 **Add file** → **Upload files**
3. 将以下文件拖入上传区域：
   - index.html
   - style.css
   - app.js
   - manifest.json
   - lucky girl图标.jpg
   - 复古背景.jpg
4. 填写提交信息：`Initial commit`
5. 点击 **Commit changes**

### 步骤 3：启用 GitHub Pages
1. 进入仓库的 **Settings** 标签
2. 左侧菜单点击 **Pages**
3. Source 选择 **Deploy from a branch**
4. Branch 选择 **main** / **root**
5. 点击 **Save**
6. 等待几分钟，访问：`https://chenzhimin87.github.io/xiaoai-ledger/`

---

## 方法二：使用 Git 命令行

### 前提条件
- 安装 Git：https://git-scm.com/download/win
- 配置好 Git 用户名和邮箱

### 部署步骤

```bash
# 1. 进入项目目录
cd "d:\workbuddy工作区\电子手账"

# 2. 初始化 Git 仓库
git init

# 3. 添加所有文件
git add .

# 4. 提交
git commit -m "Initial commit"

# 5. 添加远程仓库（替换为你的仓库地址）
git remote add origin https://github.com/chenzhimin87/xiaoai-ledger.git

# 6. 推送到 GitHub
git branch -M main
git push -u origin main
```

---

## 部署后检查清单

- [ ] 仓库已创建：https://github.com/chenzhimin87/xiaoai-ledger
- [ ] 所有文件已上传
- [ ] GitHub Pages 已启用
- [ ] 可以正常访问：https://chenzhimin87.github.io/xiaoai-ledger/

---

## 常见问题

### Q: 页面显示 404？
A: GitHub Pages 部署需要 1-5 分钟，请耐心等待后刷新。

### Q: 图片无法显示？
A: 检查文件名是否包含空格或中文，建议改为英文文件名。

### Q: 样式没有生效？
A: 按 Ctrl+F5 强制刷新浏览器缓存。

---

## 下一步：添加同步功能

部署完成后，我们可以添加以下同步方案：

### 方案 A：JSON 导出/导入（最简单）
- 添加"导出数据"按钮，生成 JSON 文件下载
- 添加"导入数据"按钮，上传 JSON 文件恢复

### 方案 B：GitHub Gist 同步
- 使用 GitHub Gist API 存储数据
- 需要用户提供 Gist Token

### 方案 C：第三方服务
- 使用 LeanCloud、Firebase 等 BaaS 服务
- 需要注册账号并配置

你想用哪个方案？
