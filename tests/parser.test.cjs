const assert = require("node:assert");
const { collectEntries } = require("../shared/parser.js");

function entry(result) {
  return { content: { itemContent: { tweet_results: { result } } } };
}
function tweet(id, sn, legacyExtra, extra) {
  return {
    __typename: "Tweet",
    rest_id: id,
    core: { user_results: { result: { legacy: { screen_name: sn } } } },
    legacy: Object.assign(
      { id_str: id, full_text: "hi", created_at: "Wed Sep 10 12:00:00 +0000 2025" },
      legacyExtra || {}
    ),
    ...(extra || {})
  };
}
const photo = { extended_entities: { media: [{ type: "photo", media_url_https: "https://pbs.twimg.com/media/A.jpg" }] } };
const vid = { extended_entities: { media: [{ type: "video", video_info: { variants: [
  { content_type: "application/x-mpegURL", url: "https://video.twimg.com/x.m3u8" },
  { bitrate: 832000, content_type: "video/mp4", url: "https://video.twimg.com/lo.mp4" },
  { bitrate: 2176000, content_type: "video/mp4", url: "https://video.twimg.com/hi.mp4" }
] } }] } };
const hls = { extended_entities: { media: [{ type: "video", video_info: { variants: [
  { content_type: "application/x-mpegURL", url: "https://video.twimg.com/only.m3u8" }
] } }] } };

const visWrap = {
  __typename: "TweetWithVisibilityResults",
  tweet: {
    rest_id: "999",
    core: { user_results: { result: { legacy: { screen_name: "vis" } } } },
    legacy: { id_str: "999", full_text: "short", created_at: "Wed Sep 10 12:00:00 +0000 2025" },
    note_tweet: { note_tweet_results: { result: { text: "LONG NOTE TEXT" } } }
  }
};

const quoteTweet = tweet("5", "quoter", {}, {
  quoted_status_result: { result: {
    __typename: "Tweet", rest_id: "6",
    core: { user_results: { result: { legacy: { screen_name: "quoted_user" } } } },
    legacy: { id_str: "6", full_text: "orig", extended_entities: { media: [
      { type: "photo", media_url_https: "https://pbs.twimg.com/media/Q.jpg" }
    ] } }
  } }
});

// X moved screen_name from user_results.result.legacy to user_results.result.core.
// Without this fixture the parser silently falls back to "unknown".
const coreUser = {
  __typename: "Tweet",
  rest_id: "7",
  core: { user_results: { result: { core: { screen_name: "newschema" } } } },
  legacy: { id_str: "7", full_text: "new user schema", created_at: "Wed Sep 10 12:00:00 +0000 2025" }
};

const payload = { data: { bookmark_timeline_v2: { timeline: { instructions: [
  { type: "TimelineAddEntries", entries: [
    entry(tweet("1", "alice", photo)),
    entry(tweet("2", "bob", vid)),
    entry(tweet("3", "carol", hls)),
    entry(visWrap.tweet ? visWrap : null),
    entry(quoteTweet),
    entry(coreUser),
    { entryId: "cursor-bottom-x", content: { value: "CURSOR" } }
  ] }
] } } } };

const out = collectEntries(payload);
const byId = Object.fromEntries(out.map((r) => [r.id, r]));

// Folder timelines arrive under a different top-level key (bookmark_collection_timeline),
// so the finder must locate the timeline by shape, not by name.
const folderPayload = { data: { bookmark_collection_timeline: { timeline: { instructions: [
  { type: "TimelineAddEntries", entries: [ entry(tweet("50", "folderuser", photo)) ] }
] } } } };
const folderOut = collectEntries(folderPayload);
assert.strictEqual(folderOut.length, 1, "folder timeline extracted via generalized finder");
assert.strictEqual(folderOut[0].id, "50", "folder tweet id");

assert.strictEqual(out.length, 6, "should extract 6 tweets, ignore cursor");
assert.strictEqual(byId["7"].screen_name, "newschema", "reads screen_name from user core (new X schema)");
assert.strictEqual(byId["1"].media[0].url, "https://pbs.twimg.com/media/A.jpg?name=orig", "photo orig");
assert.strictEqual(byId["2"].media[0].type, "video", "video type");
assert.strictEqual(byId["2"].media[0].url, "https://video.twimg.com/hi.mp4", "highest bitrate mp4");
assert.strictEqual(byId["3"].media[0].type, "video_hls", "hls-only flagged");
assert.strictEqual(byId["999"].text, "LONG NOTE TEXT", "note_tweet long text");
assert.strictEqual(byId["999"].screen_name, "vis", "visibility wrapper unwrapped");
assert.strictEqual(byId["5"].media.length, 1, "quoted media captured");
assert.strictEqual(byId["5"].media[0].quoted, true, "quoted flag set");
assert.strictEqual(byId["5"].quoted_of, "quoted_user", "quoted_of recorded");
assert.ok(typeof byId["1"].created_ms === "number" && byId["1"].created_ms > 0, "created_ms parsed");

console.log("PASS: all", out.length, "records + " +
  "media/quote/date/handle-schema assertions ok");
