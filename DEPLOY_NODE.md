# 企业微信机器人部署指南 (Node.js + Vercel 免费版)

## 概述

本指南详细介绍了如何使用 Node.js 和 Express 框架构建企业微信机器人，并将其部署到 Vercel 平台。该方案利用了企业微信官方提供的 `@wecom/crypto` 库进行消息加解密，确保了通信的安全性和稳定性。

## 第一步：准备企业微信环境

1.  登录 [企业微信管理后台](https://work.weixin.qq.com/)。
2.  在“应用管理”中创建一个自建应用。
3.  记录以下关键参数：
    *   `CORP_ID`: 企业 ID（在“我的企业”->“企业信息”中查看）。
    *   `AGENT_ID`: 应用的 AgentId。
    *   `CORP_SECRET`: 应用的 Secret。

## 第二步：配置接收消息

1.  在应用详情页，点击“接收消息”->“设置 API 接收”。
2.  设置并记录：
    *   `TOKEN`: 随机生成的 Token。
    *   `ENCODING_AES_KEY`: 随机生成的 EncodingAESKey。
3.  **注意**：先不要点击保存，需等待 Vercel 部署完成后填入 URL。

## 第三步：部署到 Vercel

1.  将代码上传到您的 GitHub 仓库。
2.  在 Vercel 中导入该项目。
3.  在 **Environment Variables** 中配置以下变量：
    *   `CORP_ID`
    *   `AGENT_ID`
    *   `CORP_SECRET`
    *   `TOKEN`
    *   `ENCODING_AES_KEY`
    *   `RECHARGE_API_URL`: 您的充值接口地址。
4.  点击 **Deploy**。部署完成后，您将获得一个类似 `https://your-project.vercel.app` 的域名。

## 第四步：完成回调配置

1.  回到企业微信后台的“API 接收”设置页面。
2.  在 **URL** 处填写：`https://your-project.vercel.app/api/wechat`。
3.  点击 **保存**。验证通过后，机器人即刻上线。

## 核心逻辑说明

*   **关键词回复**：代码中预设了“使用帮助”关键词，匹配后将返回功能菜单。
*   **充值指令**：使用正则表达式 `/\d{11}/` 提取消息中的手机号，并可扩展调用外部 API。
*   **加解密**：使用了官方 `@wecom/crypto` 库，简化了复杂的加解密流程。

## 参考文献

[1] 企业微信开发者文档 - 加解密库下载. [https://developer.work.weixin.qq.com/document/path/90307](https://developer.work.weixin.qq.com/document/path/90307)
[2] Vercel 部署文档. [https://vercel.com/docs](https://vercel.com/docs)
