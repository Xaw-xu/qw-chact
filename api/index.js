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

app.all("/api/wechat", async (req, res) => {
  const { msg_signature, timestamp, nonce, echostr } = req.query;
  console.log("🚀 ~ echostr:", echostr, req.query, req.params, req.body);

  if (req.method === "GET") {
    // 验证回调 URL
    try {
      const res = decrypt(ENCODING_AES_KEY, echostr);
      console.log("🚀 ~ res:", res);
      const { msg } = decrypt(ENCODING_AES_KEY, echostr);
      res.send(msg);
    } catch (err) {
      console.error("VerifyURL Error:", err);
      res.status(403).send("VerifyURL Error");
    }
    return;
  }

  if (req.method === "POST") {
    // 处理消息
    try {
      const { message } = decrypt(ENCODING_AES_KEY, req.body);
      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(message);
      const xmlData = result.xml;

      const msgType = xmlData.MsgType;
      const fromUser = xmlData.FromUserName;
      let responseContent = "";

      if (msgType === "text") {
        const content = xmlData.Content.trim();

        if (content === "使用帮助") {
          responseContent = HELP_TEXT;
        } else if (content.startsWith("充值")) {
          const phoneMatch = content.match(/\d{11}/);
          if (phoneMatch) {
            const phone = phoneMatch[0];
            // 调用充值 API
            // await axios.post(RECHARGE_API_URL, { phone });
            responseContent = `已收到充值请求，手机号：${phone}。正在处理中...`;
          } else {
            responseContent = "充值格式错误，请输入：充值+11位手机号";
          }
        } else {
          responseContent = `收到消息：${content}\n输入“使用帮助”查看功能。`;
        }
      } else if (msgType === "event") {
        const event = xmlData.Event;
        if (event === "sys_approval_change") {
          responseContent = "收到一笔新的支付/转账，正在核实金额...";
        }
      }

      if (responseContent) {
        const replyXml = `<xml>
                    <ToUserName><![CDATA[${fromUser}]]></ToUserName>
                    <FromUserName><![CDATA[${CORP_ID}]]></FromUserName>
                    <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
                    <MsgType><![CDATA[text]]></MsgType>
                    <Content><![CDATA[${responseContent}]]></Content>
                </xml>`;

        const encryptedMsg = encrypt(ENCODING_AES_KEY, replyXml, CORP_ID);
        const signature = getSignature(TOKEN, timestamp, nonce, encryptedMsg);

        const resXml = `<xml>
                    <Encrypt><![CDATA[${encryptedMsg}]]></Encrypt>
                    <MsgSignature><![CDATA[${signature}]]></MsgSignature>
                    <TimeStamp>${timestamp}</TimeStamp>
                    <Nonce><![CDATA[${nonce}]]></Nonce>
                </xml>`;
        res.type("application/xml");
        res.send(resXml);
      } else {
        res.send("success");
      }
    } catch (err) {
      console.error("Process Message Error:", err);
      res.status(403).send("Process Message Error");
    }
  }
});

module.exports = app;
