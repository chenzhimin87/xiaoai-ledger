# Git 安装与部署指南

## 步骤 1：下载 Git

1. 打开浏览器访问：https://git-scm.com/download/win
2. 点击下载 **64-bit Git for Windows Setup**
3. 等待下载完成

## 步骤 2：安装 Git

1. 双击下载的 `Git-2.42.0-64-bit.exe`
2. 一路点击 **Next**（使用默认设置即可）
3. 最后点击 **Install**
4. 安装完成后点击 **Finish**

## 步骤 3：配置 Git

打开 PowerShell 或 CMD，运行以下命令：

```bash
git config --global user.name "chenzhimin87"
git config --global user.email "你的邮箱@example.com"
```

## 步骤 4：部署项目

```bash
# 进入项目目录
cd "d:\workbuddy工作区\电子手账"

# 初始化 Git 仓库
git init

# 添加所有文件
git add .

# 提交文件
git commit -m "Initial commit"

# 连接远程仓库
git remote add origin https://github.com/chenzhimin87/xiaoai-ledger.git

# 推送到 GitHub
git push -u origin main
```

## 步骤 5：输入凭据

运行 `git push` 时会提示输入用户名和密码：
- **Username**: chenzhimin87
- **Password**: 输入你的 GitHub Token（ghp_开头的那串字符）

## 步骤 6：启用 GitHub Pages

1. 访问 https://github.com/chenzhimin87/xiaoai-ledger
2. 点击 **Settings** 标签
3. 左侧点击 **Pages**
4. Source 选择 **Deploy from a branch**
5. Branch 选择 **main** / **(root)**
6. 点击 **Save**
7. 等待 2-5 分钟后访问：https://chenzhimin87.github.io/xiaoai-ledger/

---

## 常见问题

### Q: git push 提示 "rejected"？
A: 运行 `git pull origin main --rebase` 后再 push

### Q: 忘记 Token 了？
A: 去 https://github.com/settings/tokens 重新生成

### Q: 页面显示 404？
A: GitHub Pages 部署需要等待 2-5 分钟

### Q: 样式或图片不显示？
A: 按 Ctrl+F5 强制刷新浏览器缓存
