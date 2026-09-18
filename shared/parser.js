(function (root) {
  function findInstructions(json) {
    const data = json && json.data;
    if (!data) return null;
    for (const k of Object.keys(data)) {
      const v = data[k];
      if (v && v.timeline && Array.isArray(v.timeline.instructions)) {
        return v.timeline.instructions;
      }
    }
    return null;
  }

  function collectEntries(json) {
    const out = [];
    const insts = findInstructions(json);
    if (!Array.isArray(insts)) return out;
    for (const inst of insts) {
      const entries = inst.entries || (inst.entry ? [inst.entry] : []);
      for (const entry of entries) {
        const rec = normalize(
          entry && entry.content && entry.content.itemContent &&
          entry.content.itemContent.tweet_results &&
          entry.content.itemContent.tweet_results.result
        );
        if (rec) out.push(rec);
      }
    }
    return out;
  }

  function unwrap(result) {
    if (!result) return null;
    let t = result;
    if (t.__typename === "TweetWithVisibilityResults" && t.tweet) t = t.tweet;
    return t.legacy ? t : null;
  }

  function screenNameOf(t) {
    const ur = t.core && t.core.user_results && t.core.user_results.result;
    if (!ur) return "unknown";
    return (ur.core && ur.core.screen_name) ||
           (ur.legacy && ur.legacy.screen_name) ||
           "unknown";
  }

  function mediaFrom(t) {
    const legacy = t.legacy || {};
    const list =
      (legacy.extended_entities && legacy.extended_entities.media) ||
      (legacy.entities && legacy.entities.media) || [];
    const media = [];
    for (const m of list) {
      if (m.type === "photo") {
        media.push({ type: "photo", url: m.media_url_https + "?name=orig" });
      } else if (m.type === "video" || m.type === "animated_gif") {
        const variants = (m.video_info && m.video_info.variants) || [];
        const mp4 = variants
          .filter((v) => v.content_type === "video/mp4")
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        if (mp4.length) {
          media.push({ type: "video", url: mp4[0].url });
        } else {
          const hls = variants.find((v) => v.content_type === "application/x-mpegURL");
          if (hls) media.push({ type: "video_hls", url: hls.url });
        }
      }
    }
    return media;
  }

  function normalize(result) {
    const t = unwrap(result);
    if (!t) return null;
    const legacy = t.legacy;
    const id = t.rest_id || legacy.id_str;
    if (!id) return null;

    const screen_name = screenNameOf(t);

    let text = legacy.full_text || "";
    if (t.note_tweet && t.note_tweet.note_tweet_results &&
        t.note_tweet.note_tweet_results.result &&
        t.note_tweet.note_tweet_results.result.text) {
      text = t.note_tweet.note_tweet_results.result.text;
    }

    const media = mediaFrom(t);

    const quoted = unwrap(t.quoted_status_result && t.quoted_status_result.result);
    if (quoted) {
      for (const qm of mediaFrom(quoted)) {
        qm.quoted = true;
        media.push(qm);
      }
    }

    const created_at = legacy.created_at || "";
    const created_ms = created_at ? Date.parse(created_at) : NaN;

    return {
      id,
      screen_name,
      url: `https://x.com/${screen_name}/status/${id}`,
      created_at,
      created_ms: isNaN(created_ms) ? null : created_ms,
      text,
      quoted_of: quoted ? screenNameOf(quoted) : null,
      media
    };
  }

  const api = { collectEntries, normalize };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.XBAParser = api;
})(typeof self !== "undefined" ? self : (typeof globalThis !== "undefined" ? globalThis : this));
