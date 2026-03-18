const { notarize } = require('@electron/notarize');
const path = require('path');

// 加载 .env 文件
require('dotenv').config();

function readEnv(name) {
  const value = process.env[name];
  if (typeof value !== 'string') return '';
  return value.trim();
}

function getNotarizeAuth() {
  const keychainProfile = readEnv('APPLE_KEYCHAIN_PROFILE');
  const keychain = readEnv('APPLE_KEYCHAIN');
  if (keychainProfile || keychain) {
    if (!keychainProfile) {
      throw new Error('缺少 APPLE_KEYCHAIN_PROFILE。使用 Keychain Profile 公证时必须提供。');
    }
    return {
      tool: 'notarytool',
      authLabel: `Keychain Profile (${keychainProfile})`,
      options: keychain
        ? { keychainProfile, keychain }
        : { keychainProfile },
    };
  }

  const appleApiKey = readEnv('APPLE_API_KEY');
  const appleApiKeyId = readEnv('APPLE_API_KEY_ID');
  const appleApiIssuer = readEnv('APPLE_API_ISSUER');
  if (appleApiKey || appleApiKeyId || appleApiIssuer) {
    if (!appleApiKey || !appleApiKeyId || !appleApiIssuer) {
      throw new Error(
        '缺少 APPLE_API_KEY / APPLE_API_KEY_ID / APPLE_API_ISSUER。使用 App Store Connect API Key 公证时必须同时提供这 3 个变量。'
      );
    }
    return {
      tool: 'notarytool',
      authLabel: `App Store Connect API Key (${appleApiKeyId})`,
      options: { appleApiKey, appleApiKeyId, appleApiIssuer },
    };
  }

  const appleId = readEnv('APPLE_ID');
  const appleIdPassword = readEnv('APPLE_APP_SPECIFIC_PASSWORD');
  const teamId = readEnv('APPLE_TEAM_ID');
  if (appleId || appleIdPassword || teamId) {
    if (!appleId || !appleIdPassword || !teamId) {
      throw new Error(
        '缺少 APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID。使用 Apple ID 公证时必须同时提供这 3 个变量。'
      );
    }
    return {
      tool: 'notarytool',
      authLabel: `Apple ID (${appleId})`,
      options: { appleId, appleIdPassword, teamId },
    };
  }

  throw new Error(
    '未配置 macOS 公证凭据。请配置以下任一组环境变量：'
    + ' APPLE_KEYCHAIN_PROFILE (+ 可选 APPLE_KEYCHAIN)，'
    + ' 或 APPLE_API_KEY / APPLE_API_KEY_ID / APPLE_API_ISSUER，'
    + ' 或 APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID。'
  );
}

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  if (readEnv('OPENJOBS_MAC_ADHOC_SIGN') === '1') {
    console.warn('⚠️  跳过公证: 当前是显式 ad-hoc 测试构建');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  const { tool, authLabel, options } = getNotarizeAuth();

  console.log(`🔐 正在公证 ${appName}...`);
  console.log(`   应用路径: ${appPath}`);
  console.log(`   工具: ${tool}`);
  console.log(`   凭据: ${authLabel}`);

  try {
    await notarize({
      tool,
      appPath,
      ...options,
    });

    console.log('✅ 公证并 stapling 成功');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ 公证失败:', message);
    console.error('   请检查签名证书、公证凭据以及 Apple Developer 账号权限');
    console.error('   访问 https://appstoreconnect.apple.com/notarization-history 查看详情');
    throw error;
  }
};
