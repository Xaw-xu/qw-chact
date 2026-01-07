const express = require("express");
const { decrypt, encrypt, getSignature } = require("@wecom/crypto");
const xml2js = require("xml2js");
const axios = require("axios");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.text({ type: "text/xml" }));

// 从环境变量获取配置
const CORP_ID = process.env.CORP_ID;
const AGENT_ID = process.env.AGENT_ID;
const CORP_SECRET = process.env.CORP_SECRET;
const TOKEN = process.env.TOKEN;
const ENCODING_AES_KEY = process.env.ENCODING_AES_KEY;
const RECHARGE_API_URL = process.env.RECHARGE_API_URL;

const HELP_TEXT = `【机器人使用帮助】
1. 发送“使用帮助”获取此菜单。
2. 发送“充值+手机号”（如：充值17888888888）进行充值。
3. 发送红包或转账，机器人将自动识别金额。`;

// 辅助函数：验证签名
function verifySignature(signature, timestamp, nonce, echostr) {
  // 企业微信实际验证逻辑
  // 这里简化为检查必要参数是否存在
  return signature && timestamp && nonce && echostr;
}

app.all("/api/wechat", async (req, res) => {
  const { msg_signature, timestamp, nonce, echostr } = req.query;

  console.log("=== 收到请求 ===");
  console.log("Method:", req.method);
  console.log("Query params:", { msg_signature, timestamp, nonce, echostr });
  console.log("Body:", req.body);

  if (req.method === "GET") {
    // 验证回调 URL
    if (!msg_signature || !timestamp || !nonce || !echostr) {
      console.error("Missing required parameters");
      return res.status(400).send("Missing required parameters");
    }

    try {
      console.log("验证回调URL，echostr:", echostr);

      // 解密echostr
      const decrypted = decrypt(ENCODING_AES_KEY, echostr);
      console.log("解密结果:", decrypted);

      // 返回解密后的明文消息
      res.send(decrypted.message);
    } catch (err) {
      console.error("VerifyURL Error:", err);
      res.status(403).send("VerifyURL Error");
    }
    return;
  }

  if (req.method === "POST") {
    // 处理消息
    if (!msg_signature || !timestamp || !nonce) {
      console.error("Missing signature parameters");
      return res.status(400).send("Missing signature parameters");
    }

    try {
      console.log("POST 消息体:", req.body);

      // 解密消息
      const encryptedXml = req.body;
      const decrypted = decrypt(ENCODING_AES_KEY, encryptedXml);
      console.log("解密后的消息:", decrypted);

      const { message, id } = decrypted;

      // 解析XML
      const parser = new xml2js.Parser({
        explicitArray: false,
        trim: true,
        normalize: true,
        explicitRoot: false,
      });

      const xmlData = await parser.parseStringPromise(message);
      console.log("解析后的XML数据:", JSON.stringify(xmlData, null, 2));

      const msgType = xmlData.MsgType;
      const fromUser = xmlData.FromUserName;
      let responseContent = "";

      if (msgType === "text") {
        const content = xmlData.Content.trim();
        console.log("收到文本消息:", content);

        if (content === "使用帮助" || content === "帮助") {
          responseContent = HELP_TEXT;
        } else if (content.startsWith("充值")) {
          const phoneMatch = content.match(/\d{11}/);
          if (phoneMatch) {
            const phone = phoneMatch[0];
            // 调用充值 API（实际使用时取消注释）
            /*
            try {
              const rechargeResponse = await axios.post(RECHARGE_API_URL, { 
                phone,
                userId: fromUser,
                agentId: AGENT_ID
              });
              console.log("充值API响应:", rechargeResponse.data);
              responseContent = `充值请求已提交！手机号：${phone}\n订单正在处理中...`;
            } catch (apiError) {
              console.error("充值API调用失败:", apiError);
              responseContent = `充值请求提交失败，手机号：${phone}\n请稍后重试或联系管理员。`;
            }
            */
            responseContent = `已收到充值请求，手机号：${phone}。正在处理中...`;
          } else {
            responseContent =
              "充值格式错误，请输入：充值+11位手机号\n例如：充值13800138000";
          }
        } else {
          responseContent = `收到消息：${content}\n输入“使用帮助”查看功能。`;
        }
      } else if (msgType === "event") {
        const event = xmlData.Event;
        console.log("收到事件消息，事件类型:", event);

        if (event === "enter_agent") {
          responseContent = "欢迎使用充值机器人！发送“使用帮助”查看使用说明。";
        } else if (event === "sys_approval_change") {
          responseContent = "收到一笔新的支付/转账，正在核实金额...";
          // 这里可以添加处理转账的逻辑
        }
      } else if (msgType === "image") {
        responseContent = "已收到图片，机器人目前仅支持文本和转账功能。";
      } else if (msgType === "voice") {
        responseContent = "已收到语音消息，机器人目前仅支持文本和转账功能。";
      }

      // 如果需要回复消息
      if (responseContent) {
        console.log("回复内容:", responseContent);

        const replyXml = `<xml>
          <ToUserName><![CDATA[${fromUser}]]></ToUserName>
          <FromUserName><![CDATA[${CORP_ID}]]></FromUserName>
          <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
          <MsgType><![CDATA[text]]></MsgType>
          <Content><![CDATA[${responseContent}]]></Content>
        </xml>`;

        // 加密回复消息
        const encryptedMsg = encrypt(ENCODING_AES_KEY, replyXml, CORP_ID);

        // 生成签名
        const signature = getSignature(
          TOKEN,
          timestamp,
          nonce,
          encryptedMsg.encrypt
        );

        // 构造回复XML
        const resXml = `<xml>
          <Encrypt><![CDATA[${encryptedMsg.encrypt}]]></Encrypt>
          <MsgSignature><![CDATA[${signature}]]></MsgSignature>
          <TimeStamp>${timestamp}</TimeStamp>
          <Nonce><![CDATA[${nonce}]]></Nonce>
        </xml>`;

        console.log("发送回复XML");
        res.type("application/xml");
        res.send(resXml);
      } else {
        // 无需回复，返回success
        console.log("无需回复，返回success");
        res.send("success");
      }
    } catch (err) {
      console.error("Process Message Error:", err);
      res.status(500).send("Process Message Error");
    }
  }
});

// 健康检查端点
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: {
      CORP_ID: CORP_ID ? "已配置" : "未配置",
      TOKEN: TOKEN ? "已配置" : "未配置",
      ENCODING_AES_KEY: ENCODING_AES_KEY ? "已配置" : "未配置",
    },
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error("全局错误:", err);
  res.status(500).json({
    error: "服务器内部错误",
    message: err.message,
  });
});

// 未找到路由处理
app.use((req, res) => {
  res.status(404).json({ error: "路由未找到" });
});

module.exports = app;
