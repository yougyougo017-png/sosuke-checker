'use strict';

/**
 * SOSUKE Checker — platform adapters.
 * Every check returns a normalized result:
 *   { status, message, url?, avatar?, extra?, source? }
 *
 * status: available | taken | unknown | invalid | rate_limited | error
 *
 * Built by sosuke.
 */

const {
  httpFetch,
  readJson,
  readText,
  pick,
  cleanText,
  pageTitle,
  isRateLimited,
  rateLimitMessage,
} = require('./http');

/* ------------------------------------------------------------------ */
/* result helpers                                                      */
/* ------------------------------------------------------------------ */

const available = (message, extra = {}) => ({ status: 'available', message, ...extra });
const taken = (message, extra = {}) => ({ status: 'taken', message, ...extra });
const unknown = (message, extra = {}) => ({ status: 'unknown', message, ...extra });
const invalid = (message, extra = {}) => ({ status: 'invalid', message, ...extra });
const limited = (message, extra = {}) => ({ status: 'rate_limited', message, ...extra });
const failed = (message, extra = {}) => ({ status: 'error', message, ...extra });

function badFormat(hint) {
  return invalid(`Doesn't fit this platform's rules — ${hint}.`);
}

/* ------------------------------------------------------------------ */
/* adapters                                                            */
/* ------------------------------------------------------------------ */

const roblox = {
  id: 'roblox',
  name: 'Roblox',
  group: 'gaming',
  color: '#f4f1ea',
  icon: 'roblox',
  weight: 92,
  hint: '3–20 letters, numbers or one underscore',
  source: 'Roblox signup availability endpoint',
  claim: 'https://www.roblox.com/signup',
  profile: (u) => `https://www.roblox.com/users/profile?username=${encodeURIComponent(u)}`,
  async check(username) {
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username) || /^_|_$/.test(username)) {
      return badFormat('3–20 letters, numbers or underscore (not first/last)');
    }

    const url =
      'https://auth.roblox.com/v1/usernames/validate?username=' +
      encodeURIComponent(username) +
      '&birthday=2006-09-21T07%3A00%3A00.000Z&context=Signup';

    const res = await httpFetch(url, { headers: { accept: 'application/json' } });
    if (isRateLimited(res)) return limited(rateLimitMessage(res));
    if (res.status !== 200) return failed(`Roblox returned HTTP ${res.status}.`);

    const data = await readJson(res);
    if (!data || typeof data.code !== 'number') {
      return unknown('Roblox sent an unexpected response.');
    }

    if (data.code === 0) {
      return available('Unclaimed on Roblox.', {
        url: this.profile(username),
        source: this.source,
      });
    }

    if (data.code === 1) {
      let avatar;
      let displayName;
      let userId;
      try {
        const userRes = await httpFetch('https://users.roblox.com/v1/usernames/users', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
          timeout: 6000,
        });
        if (userRes.ok) {
          const userData = await readJson(userRes);
          const user = userData && Array.isArray(userData.data) ? userData.data[0] : null;
          if (user) {
            userId = user.id;
            displayName = user.displayName;
            const thumbRes = await httpFetch(
              `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`,
              { timeout: 6000 }
            );
            if (thumbRes.ok) {
              const thumbData = await readJson(thumbRes);
              avatar =
                thumbData && thumbData.data && thumbData.data[0]
                  ? thumbData.data[0].imageUrl
                  : undefined;
            }
          }
        }
      } catch {
        /* avatar enrichment is optional */
      }

      return taken(
        displayName ? `In use by ${displayName}.` : 'Already in use on Roblox.',
        {
          url: this.profile(username),
          avatar,
          extra: { displayName, userId },
          source: this.source,
        }
      );
    }

    if (data.code === 2) return invalid('Roblox rejected this username.');
    if (data.code === 10) return unknown('Roblox has this username flagged or reserved.');
    return unknown(data.message || 'Roblox gave an unexpected response.');
  },
};

const discord = {
  id: 'discord',
  name: 'Discord',
  group: 'social',
  color: '#5865f2',
  icon: 'discord',
  weight: 100,
  hint: '2–32 lowercase letters, numbers, dots or underscores',
  source: 'Discord signup availability endpoint',
  claim: 'https://discord.com/register',
  profile: null,
  async check(username) {
    const name = username.toLowerCase();
    if (
      !/^[a-z0-9._]{2,32}$/.test(name) ||
      /^\.|\.$/.test(name) ||
      /\.\./.test(name)
    ) {
      return badFormat('2–32 characters; letters, numbers, dot or underscore; no leading/trailing/double dot');
    }

    const res = await httpFetch(
      'https://discord.com/api/v9/unique-username/username-attempt-unauthed',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          origin: 'https://discord.com',
          referer: 'https://discord.com/register',
          'x-discord-locale': 'en-US',
          'x-super-properties':
            'eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiQ2hyb21lIiwiZGV2aWNlIjoiIiwic3lzdGVtX2xvY2FsZSI6ImVuLVVTIiwiYnJvd3Nlcl91c2VyX2FnZW50IjoiTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgMTAuMDsgV2luNjQ7IHg2NCkgQXBwbGVXZWJLaXQvNTM3LjM2IChLSFRNTCwgbGlrZSBHZWNrbykgQ2hyb21lLzEzMS4wLjAuMCBTYWZhcmkvNTM3LjM2IiwiYnJvd3Nlcl92ZXJzaW9uIjoiMTMxLjAuMC4wIiwib3NfdmVyc2lvbiI6IjEwIiwicmVmZXJyZXIiOiIiLCJyZWZlcnJpbmdfZG9tYWluIjoiIiwicmVmZXJyZXJfY3VycmVudCI6IiIsInJlZmVycmluZ19kb21haW5fY3VycmVudCI6IiIsInJlbGVhc2VfY2hhbm5lbCI6InN0YWJsZSIsImNsaWVudF9idWlsZF9udW1iZXIiOjMxMzg3OCwiY2xpZW50X2V2ZW50X3NvdXJjZSI6bnVsbH0=',
        },
        body: JSON.stringify({ username: name }),
      }
    );

    if (isRateLimited(res)) return limited(rateLimitMessage(res));
    if (res.status === 400) {
      return invalid('Discord rejected this username as reserved or unusable.');
    }
    if (res.status !== 200) return failed(`Discord returned HTTP ${res.status}.`);

    const data = await readJson(res);
    if (!data || typeof data.taken !== 'boolean') {
      return unknown('Discord sent an unexpected response.');
    }

    if (data.taken) {
      return taken('Already taken on Discord.', {
        source: this.source,
      });
    }
    return available('Unclaimed on Discord.', {
      url: this.claim,
      source: this.source,
    });
  },
};

const minecraft = {
  id: 'minecraft',
  name: 'Minecraft',
  group: 'gaming',
  color: '#62b47a',
  icon: 'minecraft',
  weight: 84,
  hint: '3–16 letters, numbers or underscores',
  source: 'Mojang Java profile API',
  claim: 'https://www.minecraft.net/en-us/store/minecraft-java-bedrock-edition',
  profile: (u) => `https://namemc.com/profile/${encodeURIComponent(u)}`,
  async check(username) {
    if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) {
      return badFormat('3–16 letters, numbers or underscores');
    }

    const res = await httpFetch(
      `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`,
      { headers: { accept: 'application/json' } }
    );

    if (isRateLimited(res)) return limited(rateLimitMessage(res));
    if (res.status === 404 || res.status === 204) {
      return available('No Java account uses this name.', {
        url: this.claim,
        source: this.source,
      });
    }
    if (res.status !== 200) return failed(`Mojang returned HTTP ${res.status}.`);

    const data = await readJson(res);
    if (!data || !data.id) return unknown('Mojang sent an unexpected response.');

    return taken(`In use by ${data.name}.`, {
      url: this.profile(data.name),
      avatar: `https://mc-heads.net/avatar/${data.id}/128`,
      extra: { uuid: data.id, name: data.name },
      source: this.source,
    });
  },
};

const tiktok = {
  id: 'tiktok',
  name: 'TikTok',
  group: 'social',
  color: '#f4f1ea',
  icon: 'tiktok',
  weight: 97,
  hint: '2–24 letters, numbers, dots or underscores',
  source: 'TikTok public profile card + page',
  claim: 'https://www.tiktok.com/signup',
  profile: (u) => `https://www.tiktok.com/@${encodeURIComponent(u)}`,
  async check(username) {
    if (!/^[A-Za-z0-9._]{2,24}$/.test(username) || /^\.|\.$/.test(username)) {
      return badFormat('2–24 letters, numbers, dots or underscores');
    }

    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(
      `https://www.tiktok.com/@${username}`
    )}`;

    const res = await httpFetch(oembedUrl, { headers: { accept: 'application/json' } });
    if (isRateLimited(res)) return limited(rateLimitMessage(res));

    if (res.status === 200) {
      const data = await readJson(res);
      const rawAuthor = data && data.author_name ? cleanText(data.author_name) : '';
      const author = /^[.\-_]+$/.test(rawAuthor) ? '' : rawAuthor;
      return taken(author ? `In use by ${author}.` : 'Already in use on TikTok.', {
        url: this.profile(username),
        source: this.source,
      });
    }

    if (res.status === 400 || res.status === 404) {
      // The profile card says no, but confirm against the public page so a
      // private account never gets reported as free.
      try {
        const page = await httpFetch(this.profile(username), {
          headers: { accept: 'text/html' },
          timeout: 12000,
        });
        if (page.status === 200) {
          const html = await readText(page);
          const uniqueId = pick(html, /"uniqueId":"([^"]+)"/);
          const statusCode = pick(html, /"statusCode":(\d+)/);
          if (uniqueId && uniqueId.toLowerCase() === username.toLowerCase()) {
            return taken('Already in use on TikTok.', {
              url: this.profile(username),
              source: this.source,
            });
          }
          if (statusCode === '10221' || statusCode === '10222') {
            return available('Unclaimed on TikTok.', {
              url: this.claim,
              source: this.source,
            });
          }
        }
      } catch {
        /* fall through */
      }
      return available('No public TikTok profile found.', {
        url: this.claim,
        source: this.source,
      });
    }

    return unknown(`TikTok returned HTTP ${res.status}.`);
  },
};

const youtube = {
  id: 'youtube',
  name: 'YouTube',
  group: 'creator',
  color: '#ff2f2f',
  icon: 'youtube',
  weight: 90,
  hint: '3–30 letters, numbers, dots, hyphens or underscores',
  source: 'YouTube public handle page',
  claim: 'https://www.youtube.com/create_channel',
  profile: (u) => `https://www.youtube.com/@${encodeURIComponent(u)}`,
  async check(username) {
    if (!/^[A-Za-z0-9._-]{3,30}$/.test(username)) {
      return badFormat('3–30 letters, numbers, dots, hyphens or underscores');
    }

    const res = await httpFetch(this.profile(username), {
      headers: {
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
      },
      timeout: 12000,
    });

    if (isRateLimited(res)) return limited(rateLimitMessage(res));
    if (res.status === 404) {
      return available('This handle is free on YouTube.', {
        url: this.claim,
        source: this.source,
      });
    }
    if (res.status !== 200) return failed(`YouTube returned HTTP ${res.status}.`);

    const html = await readText(res);
    const title = pageTitle(html);
    if (/^404\b/i.test(title) || /This page isn't available/i.test(title)) {
      return available('This handle is free on YouTube.', {
        url: this.claim,
        source: this.source,
      });
    }

    const channelId = pick(html, /"channelId":"([^"]+)"/);
    const avatar = pick(html, /<meta property="og:image" content="([^"]+)"/);
    if (!channelId && !avatar) return unknown('YouTube served an unexpected page.');

    const display = title.replace(/\s*-\s*YouTube$/, '');
    return taken(display ? `In use by ${display}.` : 'Already in use on YouTube.', {
      url: this.profile(username),
      avatar,
      extra: { displayName: display, channelId },
      source: this.source,
    });
  },
};

const x = {
  id: 'x',
  name: 'X / Twitter',
  group: 'social',
  color: '#f4f1ea',
  icon: 'x',
  weight: 88,
  hint: '1–15 letters, numbers or underscores',
  source: 'x.com public profile (FxTwitter fallback)',
  claim: 'https://x.com/i/flow/signup',
  profile: (u) => `https://x.com/${encodeURIComponent(u)}`,
  async check(username) {
    if (!/^[A-Za-z0-9_]{1,15}$/.test(username)) {
      return badFormat('1–15 letters, numbers or underscores');
    }

    // Primary: the public profile page. Free handles 404; taken handles carry
    // the display name and avatar in their Open Graph tags. No login required.
    const page = await httpFetch(`https://x.com/${encodeURIComponent(username)}`, {
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (page.status === 404) {
      return available('Unclaimed on X.', { url: this.claim, source: this.source });
    }

    if (page.status === 200) {
      const html = await readText(page);
      const docTitle = pageTitle(html);
      const ogTitle =
        cleanText(pick(html, /property="og:title"\s+content="([^"]+)"/i)) || docTitle;

      if (/suspended/i.test(`${docTitle} ${ogTitle}`)) {
        return taken('The handle exists but the account is suspended.', {
          url: this.profile(username),
          source: this.source,
        });
      }

      const match = ogTitle.match(/^(.*?)\s*\(@([A-Za-z0-9_]+)\)/);
      if (match) {
        const display = cleanText(match[1]);
        const rawAvatar = pick(html, /property="og:image"\s+content="([^"]+)"/i);
        const avatar =
          rawAvatar && /^https:\/\/pbs\.twimg\.com\//.test(rawAvatar)
            ? rawAvatar.replace(/_(normal|200x200|400x400)\./, '_400x400.')
            : undefined;

        return taken(display ? `In use by ${display}.` : 'Already in use on X.', {
          url: `https://x.com/${match[2]}`,
          avatar,
          extra: { displayName: display },
          source: this.source,
        });
      }
      // A login interstitial or an unexpected layout — fall through to the API.
    }

    // Fallback: FxTwitter's public v2 profile endpoint, used only when the page
    // answer is unusable. This keeps X working if x.com tightens its HTML.
    const res = await httpFetch(
      `https://api.fxtwitter.com/2/profile/${encodeURIComponent(username)}`,
      { headers: { accept: 'application/json' } }
    );

    if (res.status === 404) {
      return available('Unclaimed on X.', { url: this.claim, source: this.source });
    }
    if (isRateLimited(res)) return limited(rateLimitMessage(res));
    if (res.status !== 200) {
      return unknown(
        `X gave an unreadable profile page (HTTP ${page.status}) and the fallback returned HTTP ${res.status}.`
      );
    }

    const data = await readJson(res);
    if (!data || !data.user) {
      if (data && data.code === 404) {
        return available('Unclaimed on X.', { url: this.claim, source: this.source });
      }
      return unknown('X sent an unexpected response.');
    }

    const user = data.user;
    const avatar = user.avatar_url
      ? String(user.avatar_url).replace(/_normal\./, '_400x400.')
      : undefined;

    return taken(user.name ? `In use by ${cleanText(user.name)}.` : 'Already in use on X.', {
      url: `https://x.com/${user.screen_name || username}`,
      avatar,
      extra: {
        displayName: user.name,
        followers: user.followers,
        verified: user.verification && user.verification.verified,
      },
      source: this.source,
    });
  },
};

const twitch = {
  id: 'twitch',
  name: 'Twitch',
  group: 'gaming',
  color: '#9146ff',
  icon: 'twitch',
  weight: 68,
  hint: '4–25 letters, numbers or underscores',
  source: 'Twitch public GraphQL',
  claim: 'https://www.twitch.tv/signup',
  profile: (u) => `https://www.twitch.tv/${encodeURIComponent(u)}`,
  async check(username) {
    if (!/^[A-Za-z0-9_]{4,25}$/.test(username)) {
      return badFormat('4–25 letters, numbers or underscores');
    }

    const res = await httpFetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'client-id': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
      },
      body: JSON.stringify({
        query:
          'query($login:String!){user(login:$login){id displayName profileImageURL(width:150)}}',
        variables: { login: username.toLowerCase() },
      }),
    });

    if (isRateLimited(res)) return limited(rateLimitMessage(res));
    if (res.status !== 200) return failed(`Twitch returned HTTP ${res.status}.`);

    const data = await readJson(res);
    if (!data || !data.data) return unknown('Twitch sent an unexpected response.');
    const user = data.data.user;

    if (!user) {
      return available('Unclaimed on Twitch.', {
        url: this.claim,
        source: this.source,
      });
    }

    return taken(user.displayName ? `In use by ${user.displayName}.` : 'Already in use on Twitch.', {
      url: this.profile(user.displayName || username),
      avatar: user.profileImageURL,
      extra: { displayName: user.displayName, userId: user.id },
      source: this.source,
    });
  },
};

const kick = {
  id: 'kick',
  name: 'Kick',
  group: 'gaming',
  color: '#53fc18',
  icon: 'kick',
  weight: 48,
  hint: '3–25 letters, numbers, hyphens or underscores',
  source: 'Kick public channel API',
  claim: 'https://kick.com/register',
  profile: (u) => `https://kick.com/${encodeURIComponent(u)}`,
  async check(username) {
    if (!/^[A-Za-z0-9_-]{3,25}$/.test(username)) {
      return badFormat('3–25 letters, numbers, hyphens or underscores');
    }

    const endpoint = `https://kick.com/api/v2/channels/${encodeURIComponent(username)}`;
    let res = await httpFetch(endpoint, { headers: { accept: 'application/json' } });

    // Kick occasionally answers a burst with 405/5xx; one polite retry.
    if (res.status === 405 || res.status >= 500) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 350));
        res = await httpFetch(endpoint, {
          headers: {
            accept: 'application/json',
            origin: 'https://kick.com',
            referer: 'https://kick.com/',
          },
        });
      } catch {
        /* keep the first answer */
      }
    }

    if (isRateLimited(res)) return limited(rateLimitMessage(res));
    if (res.status === 404) {
      return available('No Kick channel uses this name.', {
        url: this.claim,
        source: this.source,
      });
    }
    if (res.status !== 200) return failed(`Kick returned HTTP ${res.status}.`);

    const data = await readJson(res);
    if (!data) return unknown('Kick sent an unexpected response.');

    const user = data.user || {};
    const display = user.username || data.slug || username;
    const followers = data.followers_count ?? data.followersCount;

    return taken(`In use by ${display}.`, {
      url: this.profile(data.slug || display),
      avatar: user.profile_pic || user.profilePic,
      extra: { displayName: display, followers },
      source: this.source,
    });
  },
};

const steam = {
  id: 'steam',
  name: 'Steam',
  group: 'gaming',
  color: '#f4f1ea',
  icon: 'steam',
  weight: 62,
  hint: '2–32 letters, numbers, hyphens or underscores',
  source: 'Steam public vanity URL XML',
  claim: 'https://store.steampowered.com/join',
  profile: (u) => `https://steamcommunity.com/id/${encodeURIComponent(u)}`,
  async check(username) {
    if (!/^[A-Za-z0-9_-]{2,32}$/.test(username)) {
      return badFormat('2–32 letters, numbers, hyphens or underscores');
    }

    const res = await httpFetch(`${this.profile(username)}/?xml=1`, {
      headers: { accept: 'application/xml, text/xml, */*' },
    });

    if (isRateLimited(res)) return limited(rateLimitMessage(res));
    if (res.status !== 200) return failed(`Steam returned HTTP ${res.status}.`);

    const xml = await readText(res);
    if (/<error>/i.test(xml)) {
      return available('This custom URL is free on Steam.', {
        url: this.claim,
        source: this.source,
      });
    }

    const steamId64 = pick(xml, /<steamID64>(\d+)<\/steamID64>/i);
    const persona = cleanText(pick(xml, /<steamID><!\[CDATA\[([\s\S]*?)\]\]><\/steamID>/i));
    const avatar = pick(xml, /<avatarFull><!\[CDATA\[([\s\S]*?)\]\]><\/avatarFull>/i);
    if (!steamId64) return unknown('Steam served an unexpected profile page.');

    return taken(persona ? `In use by ${persona}.` : 'This custom URL is taken on Steam.', {
      url: this.profile(username),
      avatar,
      extra: { displayName: persona, steamId64 },
      source: this.source,
    });
  },
};

const telegram = {
  id: 'telegram',
  name: 'Telegram',
  group: 'social',
  color: '#26a5e4',
  icon: 'telegram',
  weight: 55,
  hint: '5–32 letters, numbers or underscores',
  source: 'Telegram public t.me page',
  claim: 'https://telegram.org/',
  profile: (u) => `https://t.me/${encodeURIComponent(u)}`,
  async check(username) {
    if (!/^[A-Za-z0-9_]{5,32}$/.test(username)) {
      return badFormat('5–32 letters, numbers or underscores');
    }

    const res = await httpFetch(this.profile(username), {
      headers: { accept: 'text/html' },
    });

    if (isRateLimited(res)) return limited(rateLimitMessage(res));
    if (res.status !== 200) return failed(`Telegram returned HTTP ${res.status}.`);

    const html = await readText(res);
    const hasPage = /class="tgme_page_title"/.test(html) || /class="tgme_page_extra"/.test(html);

    if (!hasPage) {
      return available('This username is free on Telegram.', {
        url: this.claim,
        source: this.source,
      });
    }

    const name = cleanText(
      pick(html, /class="tgme_page_title"[^>]*>([\s\S]*?)<\/div>/i) ||
        pick(html, /property="og:title" content="([^"]*)"/i)
    );
    const extra = cleanText(pick(html, /class="tgme_page_extra">([\s\S]*?)<\/div>/i));
    const avatar =
      pick(html, /class="tgme_page_photo_image"[^>]*>\s*<img[^>]+src="([^"]+)"/i) ||
      pick(html, /class="tgme_page_photo_image"[^>]*background-image:url\('([^']+)'\)/i);

    let message = name ? `In use by ${name}.` : 'This username is taken on Telegram.';
    if (extra && /(subscriber|member|online|monthly|post)/i.test(extra)) {
      message += ` ${extra}.`;
    }

    return taken(message, {
      url: this.profile(username),
      avatar,
      extra: { displayName: name, info: extra },
      source: this.source,
    });
  },
};

const soundcloud = {
  id: 'soundcloud',
  name: 'SoundCloud',
  group: 'creator',
  color: '#ff5500',
  icon: 'soundcloud',
  weight: 42,
  hint: '3–25 letters, numbers, hyphens or underscores',
  source: 'SoundCloud public profile page',
  claim: 'https://soundcloud.com/signup',
  profile: (u) => `https://soundcloud.com/${encodeURIComponent(u)}`,
  async check(username) {
    if (!/^[A-Za-z0-9_-]{3,25}$/.test(username)) {
      return badFormat('3–25 letters, numbers, hyphens or underscores');
    }

    const res = await httpFetch(this.profile(username), {
      headers: { accept: 'text/html' },
    });

    if (isRateLimited(res)) return limited(rateLimitMessage(res));
    if (res.status === 404) {
      return available('No SoundCloud profile uses this URL.', {
        url: this.claim,
        source: this.source,
      });
    }
    if (res.status !== 200) return failed(`SoundCloud returned HTTP ${res.status}.`);

    const html = await readText(res);
    const title = pageTitle(html).replace(/\s*\|\s*Listen.*$/i, '').replace(/^Stream\s+/i, '');
    const avatar = pick(html, /property="og:image" content="([^"]+)"/i);

    return taken(title ? `In use by ${title}.` : 'Already in use on SoundCloud.', {
      url: this.profile(username),
      avatar,
      extra: { displayName: title },
      source: this.source,
    });
  },
};

const github = {
  id: 'github',
  name: 'GitHub',
  group: 'dev',
  color: '#f4f1ea',
  icon: 'github',
  weight: 74,
  hint: '1–39 letters, numbers or single hyphens',
  source: 'GitHub REST API',
  claim: 'https://github.com/signup',
  profile: (u) => `https://github.com/${encodeURIComponent(u)}`,
  async check(username) {
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(username)) {
      return badFormat('1–39 letters, numbers or single hyphens (not first/last)');
    }

    const headers = {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
    };
    if (process.env.GITHUB_TOKEN) {
      headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const res = await httpFetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers,
      timeout: 10000,
    });

    if (res.status === 404) {
      return available('Unclaimed on GitHub.', {
        url: this.claim,
        source: this.source,
      });
    }

    const remaining = res.headers.get('x-ratelimit-remaining');
    if (isRateLimited(res) || (res.status === 403 && remaining === '0')) {
      return limited(
        'GitHub rate limit hit (60 checks/hour without a token). Add GITHUB_TOKEN to lift it.'
      );
    }
    if (res.status === 403) {
      return unknown('GitHub blocked the lookup from this network.');
    }
    if (res.status !== 200) return failed(`GitHub returned HTTP ${res.status}.`);

    const data = await readJson(res);
    if (!data || !data.login) return unknown('GitHub sent an unexpected response.');

    return taken(data.name ? `In use by ${data.name}.` : 'Already in use on GitHub.', {
      url: data.html_url || this.profile(data.login),
      avatar: data.avatar_url,
      extra: {
        displayName: data.name,
        followers: data.followers,
        publicRepos: data.public_repos,
      },
      source: this.source,
    });
  },
};

const gitlab = {
  id: 'gitlab',
  name: 'GitLab',
  group: 'dev',
  color: '#fc6d26',
  icon: 'gitlab',
  weight: 36,
  hint: '2–64 letters, numbers, dots, hyphens or underscores',
  source: 'GitLab public users API',
  claim: 'https://gitlab.com/users/sign_up',
  profile: (u) => `https://gitlab.com/${encodeURIComponent(u)}`,
  async check(username) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/.test(username)) {
      return badFormat('2–64 chars; start with a letter or number');
    }

    const res = await httpFetch(
      `https://gitlab.com/api/v4/users?username=${encodeURIComponent(username)}`,
      { headers: { accept: 'application/json' } }
    );

    if (isRateLimited(res)) return limited(rateLimitMessage(res));
    if (res.status !== 200) return failed(`GitLab returned HTTP ${res.status}.`);

    const data = await readJson(res);
    if (!Array.isArray(data)) return unknown('GitLab sent an unexpected response.');
    if (data.length === 0) {
      return available('Unclaimed on GitLab.', {
        url: this.claim,
        source: this.source,
      });
    }

    const user = data[0];
    return taken(user.name ? `In use by ${user.name}.` : 'Already in use on GitLab.', {
      url: user.web_url || this.profile(user.username),
      avatar: user.avatar_url,
      extra: { displayName: user.name, username: user.username },
      source: this.source,
    });
  },
};

const pinterest = {
  id: 'pinterest',
  name: 'Pinterest',
  group: 'social',
  color: '#e60023',
  icon: 'pinterest',
  weight: 52,
  hint: '3–30 letters, numbers, dots, hyphens or underscores',
  source: 'Pinterest public profile page',
  claim: 'https://www.pinterest.com/business/create/',
  profile: (u) => `https://www.pinterest.com/${encodeURIComponent(u)}/`,
  async check(username) {
    if (!/^[A-Za-z0-9._-]{3,30}$/.test(username)) {
      return badFormat('3–30 letters, numbers, dots, hyphens or underscores');
    }

    const res = await httpFetch(this.profile(username), {
      headers: { accept: 'text/html' },
      timeout: 12000,
    });

    if (isRateLimited(res)) return limited(rateLimitMessage(res));
    if (res.status !== 200) return failed(`Pinterest returned HTTP ${res.status}.`);

    const html = await readText(res);
    const title = pageTitle(html);

    if (title && /- Profile\s*\|\s*Pinterest/i.test(title)) {
      const display = cleanText(title.replace(/\s*\([^)]*\)\s*- Profile.*$/i, ''));
      return taken(display ? `In use by ${display}.` : 'Already in use on Pinterest.', {
        url: this.profile(username),
        avatar: `https://unavatar.io/pinterest/${encodeURIComponent(username)}`,
        extra: { displayName: display },
        source: this.source,
      });
    }

    if (!title || /^Pinterest$/i.test(title)) {
      return available('No Pinterest profile found at this name.', {
        url: this.claim,
        source: this.source,
      });
    }

    return unknown('Pinterest returned an unfamiliar page.');
  },
};

const patreon = {
  id: 'patreon',
  name: 'Patreon',
  group: 'creator',
  color: '#ff424d',
  icon: 'patreon',
  weight: 40,
  hint: '3–30 letters, numbers or underscores',
  source: 'Patreon public creator page',
  claim: 'https://www.patreon.com/signup',
  profile: (u) => `https://www.patreon.com/${encodeURIComponent(u)}`,
  async check(username) {
    if (!/^[A-Za-z0-9_-]{3,30}$/.test(username)) {
      return badFormat('3–30 letters, numbers, hyphens or underscores');
    }

    const res = await httpFetch(this.profile(username), {
      headers: { accept: 'text/html' },
      timeout: 12000,
    });

    if (isRateLimited(res)) return limited(rateLimitMessage(res));
    if (res.status === 404) {
      return available('No Patreon creator uses this URL.', {
        url: this.claim,
        source: this.source,
      });
    }
    if (res.status !== 200) return failed(`Patreon returned HTTP ${res.status}.`);

    const html = await readText(res);
    const title = pageTitle(html);
    if (/not found/i.test(title)) {
      return available('No Patreon creator uses this URL.', {
        url: this.claim,
        source: this.source,
      });
    }

    const display = cleanText(
      title.replace(/\s*on Patreon\s*\|\s*Patreon$/i, '').replace(/\s*\|\s*Patreon$/i, '')
    );
    const avatar = pick(html, /property="og:image" content="([^"]+)"/i);
    return taken(display ? `In use by ${display}.` : 'Already in use on Patreon.', {
      url: this.profile(username),
      avatar,
      extra: { displayName: display },
      source: this.source,
    });
  },
};

const dribbble = {
  id: 'dribbble',
  name: 'Dribbble',
  group: 'creator',
  color: '#ea4c89',
  icon: 'dribbble',
  weight: 32,
  hint: '2–30 letters, numbers, hyphens or underscores',
  source: 'Dribbble public profile page',
  claim: 'https://dribbble.com/signup',
  profile: (u) => `https://dribbble.com/${encodeURIComponent(u)}`,
  async check(username) {
    if (!/^[A-Za-z0-9_-]{2,30}$/.test(username)) {
      return badFormat('2–30 letters, numbers, hyphens or underscores');
    }

    const res = await httpFetch(this.profile(username), {
      headers: { accept: 'text/html' },
      timeout: 12000,
    });

    if (isRateLimited(res)) return limited(rateLimitMessage(res));
    if (res.status === 404) {
      return available('No Dribbble profile uses this name.', {
        url: this.claim,
        source: this.source,
      });
    }
    if (res.status !== 200) return failed(`Dribbble returned HTTP ${res.status}.`);

    const html = await readText(res);
    const avatar = pick(html, /property="og:image" content="([^"]+)"/i);
    return taken('Already in use on Dribbble.', {
      url: this.profile(username),
      avatar,
      source: this.source,
    });
  },
};

const bluesky = {
  id: 'bluesky',
  name: 'Bluesky',
  group: 'social',
  color: '#0285ff',
  icon: 'bluesky',
  weight: 38,
  hint: 'default @name.bsky.social handle',
  source: 'AT Protocol public handle resolver',
  claim: 'https://bsky.app/',
  profile: (u) => `https://bsky.app/profile/${encodeURIComponent(u)}.bsky.social`,
  async check(username) {
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(username)) {
      return badFormat('letters, numbers or hyphens (not first/last)');
    }

    const handle = `${username}.bsky.social`;
    const res = await httpFetch(
      `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
      { headers: { accept: 'application/json' } }
    );

    if (isRateLimited(res)) return limited(rateLimitMessage(res));
    if (res.status === 400) {
      return available(`@${handle} is free. Custom-domain handles aren't checked.`, {
        url: this.claim,
        source: this.source,
      });
    }
    if (res.status !== 200) return failed(`Bluesky returned HTTP ${res.status}.`);

    const data = await readJson(res);
    if (!data || !data.did) return unknown('Bluesky sent an unexpected response.');

    let avatar;
    let displayName;
    let followers;
    try {
      const profileRes = await httpFetch(
        `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(handle)}`,
        { headers: { accept: 'application/json' }, timeout: 6000 }
      );
      if (profileRes.ok) {
        const profile = await readJson(profileRes);
        if (profile) {
          avatar = profile.avatar;
          displayName = profile.displayName;
          followers = profile.followersCount;
        }
      }
    } catch {
      /* optional enrichment */
    }

    return taken(
      displayName ? `In use by ${displayName} (@${handle}).` : `@${handle} is already taken.`,
      {
        url: this.profile(username),
        avatar,
        extra: { handle, displayName, followers, did: data.did },
        source: this.source,
      }
    );
  },
};

/* ------------------------------------------------------------------ */
/* registry / public metadata                                          */
/* ------------------------------------------------------------------ */

const PLATFORMS = [
  roblox,
  minecraft,
  steam,
  twitch,
  kick,
  discord,
  tiktok,
  x,
  telegram,
  bluesky,
  pinterest,
  youtube,
  soundcloud,
  patreon,
  dribbble,
  github,
  gitlab,
];

const BY_ID = new Map(PLATFORMS.map((p) => [p.id, p]));

function getPlatform(id) {
  return BY_ID.get(String(id || '').toLowerCase());
}

function publicPlatforms() {
  return PLATFORMS.map((p) => ({
    id: p.id,
    name: p.name,
    group: p.group,
    color: p.color,
    icon: p.icon,
    weight: p.weight,
    hint: p.hint,
    source: p.source,
    claim: p.claim,
    profile: Boolean(p.profile),
  }));
}

module.exports = { PLATFORMS, getPlatform, publicPlatforms };
