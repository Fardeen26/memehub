import { describe, expect, it } from 'vitest';
import {
    filterIndiaTrends,
    mapWikimediaImages,
    mapYouTubeVideos,
    parseGoogleTrendsRss,
    youtubePublishedAfter,
} from './indiaTrendSources';

const GOOGLE_TRENDS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:ht="https://trends.google.com/trending/rss" version="2.0">
  <channel>
    <item>
      <title>जनता पार्टी</title>
      <ht:approx_traffic>20000+</ht:approx_traffic>
      <pubDate>Sat, 25 Jul 2026 06:00:00 -0700</pubDate>
      <ht:picture>https://images.example.com/cjp.jpg</ht:picture>
      <ht:picture_source>AajTak</ht:picture_source>
      <ht:news_item>
        <ht:news_item_title>Dharmendra Pradhan resigns after Cockroach Janta Party protest</ht:news_item_title>
        <ht:news_item_url>https://news.example.com/dharmendra-pradhan</ht:news_item_url>
        <ht:news_item_picture>https://images.example.com/pradhan.jpg</ht:news_item_picture>
        <ht:news_item_source>Example News &amp; Media</ht:news_item_source>
      </ht:news_item>
      <ht:news_item>
        <ht:news_item_title>Unsafe source</ht:news_item_title>
        <ht:news_item_url>javascript:alert(1)</ht:news_item_url>
        <ht:news_item_source>Bad source</ht:news_item_source>
      </ht:news_item>
    </item>
  </channel>
</rss>`;

describe('India trend source mapping', () => {
    it('turns the India Trends RSS feed into attributed, safe trend signals', () => {
        expect(parseGoogleTrendsRss(GOOGLE_TRENDS_FIXTURE)).toEqual([
            expect.objectContaining({
                title: 'जनता पार्टी',
                approximateTraffic: 20_000,
                trafficLabel: '20000+',
                imageUrl: 'https://images.example.com/cjp.jpg',
                imageSource: 'AajTak',
                sources: [
                    expect.objectContaining({
                        title: 'Dharmendra Pradhan resigns after Cockroach Janta Party protest',
                        publisher: 'Example News & Media',
                        url: 'https://news.example.com/dharmendra-pradhan',
                    }),
                ],
            }),
        ]);
    });

    it('finds a trend from words present in its coverage, not only its headline', () => {
        const trends = parseGoogleTrendsRss(GOOGLE_TRENDS_FIXTURE);

        expect(filterIndiaTrends(trends, 'Dharmendra Pradhan')).toHaveLength(1);
        expect(filterIndiaTrends(trends, 'Narendra Modi')).toEqual([]);
    });

    it('maps only canvas-safe Wikimedia image renditions and keeps the license', () => {
        const result = mapWikimediaImages({
            query: {
                pages: {
                    '12': {
                        pageid: 12,
                        title: 'File:Narendra Modi portrait.jpg',
                        imageinfo: [
                            {
                                thumburl: 'https://upload.wikimedia.org/modi-1200.jpg',
                                thumbwidth: 1_200,
                                thumbheight: 800,
                                mime: 'image/jpeg',
                                descriptionurl: 'https://commons.wikimedia.org/wiki/File:Modi.jpg',
                                extmetadata: {
                                    Artist: {
                                        value: '<a href="https://example.com">Government photographer</a>',
                                    },
                                    Attribution: {
                                        value: 'Photo: Government of India / PIB',
                                    },
                                    AttributionRequired: { value: 'true' },
                                    LicenseShortName: { value: 'CC BY-SA 4.0' },
                                    LicenseUrl: {
                                        value: 'https://creativecommons.org/licenses/by-sa/4.0/',
                                    },
                                    Restrictions: {
                                        value: '<b>Personality rights</b> may apply',
                                    },
                                    UsageTerms: {
                                        value: 'Creative Commons Attribution-ShareAlike 4.0',
                                    },
                                },
                            },
                        ],
                    },
                    '13': {
                        pageid: 13,
                        title: 'File:Unsafe.svg',
                        imageinfo: [
                            {
                                thumburl: 'https://upload.wikimedia.org/unsafe.svg',
                                thumbwidth: 200,
                                thumbheight: 200,
                                mime: 'image/svg+xml',
                                descriptionurl: 'https://commons.wikimedia.org/wiki/File:Unsafe.svg',
                                extmetadata: {
                                    LicenseShortName: { value: 'CC0' },
                                },
                            },
                        ],
                    },
                },
            },
        });

        expect(result).toEqual([
            expect.objectContaining({
                title: 'Narendra Modi portrait',
                assetUrl: 'https://upload.wikimedia.org/modi-1200.jpg',
                creator: 'Government photographer',
                creditLine: 'Photo: Government of India / PIB',
                licenseName: 'CC BY-SA 4.0',
                mimeType: 'image/jpeg',
                attributionRequired: true,
                restrictions: 'Personality rights may apply',
                sourceUrl: 'https://commons.wikimedia.org/wiki/File:Modi.jpg',
                usageTerms: 'Creative Commons Attribution-ShareAlike 4.0',
            }),
        ]);
    });

    it('fails closed for unknown or non-editable Wikimedia licenses', () => {
        const result = mapWikimediaImages({
            query: {
                pages: {
                    '21': {
                        pageid: 21,
                        title: 'File:Unknown portrait.jpg',
                        imageinfo: [
                            {
                                thumburl:
                                    'https://upload.wikimedia.org/unknown.jpg',
                                thumbwidth: 800,
                                thumbheight: 600,
                                mime: 'image/jpeg',
                                descriptionurl:
                                    'https://commons.wikimedia.org/wiki/File:Unknown.jpg',
                                extmetadata: {
                                    LicenseShortName: { value: 'NASA' },
                                },
                            },
                        ],
                    },
                    '22': {
                        pageid: 22,
                        title: 'File:No derivatives portrait.jpg',
                        imageinfo: [
                            {
                                thumburl:
                                    'https://upload.wikimedia.org/no-derivatives.jpg',
                                thumbwidth: 800,
                                thumbheight: 600,
                                mime: 'image/jpeg',
                                descriptionurl:
                                    'https://commons.wikimedia.org/wiki/File:NoDerivatives.jpg',
                                extmetadata: {
                                    LicenseShortName: {
                                        value: 'CC BY-ND 4.0',
                                    },
                                },
                            },
                        ],
                    },
                    '23': {
                        pageid: 23,
                        title: 'File:Government portrait.jpg',
                        imageinfo: [
                            {
                                thumburl:
                                    'https://upload.wikimedia.org/government.jpg',
                                thumbwidth: 800,
                                thumbheight: 600,
                                mime: 'image/jpeg',
                                descriptionurl:
                                    'https://commons.wikimedia.org/wiki/File:Government.jpg',
                                extmetadata: {
                                    Artist: {
                                        value: 'Government photographer',
                                    },
                                    LicenseShortName: {
                                        value: 'GODL-India',
                                    },
                                },
                            },
                        ],
                    },
                    '24': {
                        pageid: 24,
                        title: 'File:Fake public domain portrait.jpg',
                        imageinfo: [
                            {
                                thumburl:
                                    'https://upload.wikimedia.org/fake-pd.jpg',
                                thumbwidth: 800,
                                thumbheight: 600,
                                mime: 'image/jpeg',
                                descriptionurl:
                                    'https://commons.wikimedia.org/wiki/File:FakePD.jpg',
                                extmetadata: {
                                    LicenseShortName: {
                                        value: 'PD All Rights Reserved',
                                    },
                                },
                            },
                        ],
                    },
                    '25': {
                        pageid: 25,
                        title: 'File:Fake documentation portrait.jpg',
                        imageinfo: [
                            {
                                thumburl:
                                    'https://upload.wikimedia.org/fake-gfdl.jpg',
                                thumbwidth: 800,
                                thumbheight: 600,
                                mime: 'image/jpeg',
                                descriptionurl:
                                    'https://commons.wikimedia.org/wiki/File:FakeGFDL.jpg',
                                extmetadata: {
                                    LicenseShortName: {
                                        value: 'GFDL no derivatives',
                                    },
                                },
                            },
                        ],
                    },
                    '26': {
                        pageid: 26,
                        title: 'File:Fake government portrait.jpg',
                        imageinfo: [
                            {
                                thumburl:
                                    'https://upload.wikimedia.org/fake-godl.jpg',
                                thumbwidth: 800,
                                thumbheight: 600,
                                mime: 'image/jpeg',
                                descriptionurl:
                                    'https://commons.wikimedia.org/wiki/File:FakeGODL.jpg',
                                extmetadata: {
                                    Artist: { value: 'Example photographer' },
                                    LicenseShortName: {
                                        value: 'GODL-India no derivatives',
                                    },
                                },
                            },
                        ],
                    },
                    '27': {
                        pageid: 27,
                        title: 'File:Missing required credit.jpg',
                        imageinfo: [
                            {
                                thumburl:
                                    'https://upload.wikimedia.org/missing-credit.jpg',
                                thumbwidth: 800,
                                thumbheight: 600,
                                mime: 'image/jpeg',
                                descriptionurl:
                                    'https://commons.wikimedia.org/wiki/File:MissingCredit.jpg',
                                extmetadata: {
                                    AttributionRequired: { value: 'true' },
                                    LicenseShortName: { value: 'CC BY 4.0' },
                                },
                            },
                        ],
                    },
                    '28': {
                        pageid: 28,
                        title: 'File:Nonexistent attribution version.jpg',
                        imageinfo: [
                            {
                                thumburl:
                                    'https://upload.wikimedia.org/fake-cc-by-version.jpg',
                                thumbwidth: 800,
                                thumbheight: 600,
                                mime: 'image/jpeg',
                                descriptionurl:
                                    'https://commons.wikimedia.org/wiki/File:FakeCCBYVersion.jpg',
                                extmetadata: {
                                    Artist: { value: 'Example photographer' },
                                    LicenseShortName: {
                                        value: 'CC BY 4.9',
                                    },
                                },
                            },
                        ],
                    },
                    '29': {
                        pageid: 29,
                        title: 'File:Nonexistent share-alike version.jpg',
                        imageinfo: [
                            {
                                thumburl:
                                    'https://upload.wikimedia.org/fake-cc-by-sa-version.jpg',
                                thumbwidth: 800,
                                thumbheight: 600,
                                mime: 'image/jpeg',
                                descriptionurl:
                                    'https://commons.wikimedia.org/wiki/File:FakeCCBYSAVersion.jpg',
                                extmetadata: {
                                    Artist: { value: 'Example photographer' },
                                    LicenseShortName: {
                                        value: 'CC BY-SA 3.7',
                                    },
                                },
                            },
                        ],
                    },
                    '30': {
                        pageid: 30,
                        title: 'File:Malformed license alias.jpg',
                        imageinfo: [
                            {
                                thumburl:
                                    'https://upload.wikimedia.org/fake-license-alias.jpg',
                                thumbwidth: 800,
                                thumbheight: 600,
                                mime: 'image/jpeg',
                                descriptionurl:
                                    'https://commons.wikimedia.org/wiki/File:FakeLicenseAlias.jpg',
                                extmetadata: {
                                    Artist: { value: 'Example photographer' },
                                    LicenseShortName: {
                                        value: 'CC--BY 4.0',
                                    },
                                },
                            },
                        ],
                    },
                    '31': {
                        pageid: 31,
                        title: 'File:Dash credit.jpg',
                        imageinfo: [
                            {
                                thumburl:
                                    'https://upload.wikimedia.org/dash-credit.jpg',
                                thumbwidth: 800,
                                thumbheight: 600,
                                mime: 'image/jpeg',
                                descriptionurl:
                                    'https://commons.wikimedia.org/wiki/File:DashCredit.jpg',
                                extmetadata: {
                                    Artist: { value: '—' },
                                    LicenseShortName: { value: 'CC BY 4.0' },
                                },
                            },
                        ],
                    },
                    '32': {
                        pageid: 32,
                        title: 'File:Unavailable credit.jpg',
                        imageinfo: [
                            {
                                thumburl:
                                    'https://upload.wikimedia.org/unavailable-credit.jpg',
                                thumbwidth: 800,
                                thumbheight: 600,
                                mime: 'image/jpeg',
                                descriptionurl:
                                    'https://commons.wikimedia.org/wiki/File:UnavailableCredit.jpg',
                                extmetadata: {
                                    Artist: { value: 'N/A' },
                                    LicenseShortName: { value: 'CC BY 4.0' },
                                },
                            },
                        ],
                    },
                    '33': {
                        pageid: 33,
                        title: 'File:Unknown credit.jpg',
                        imageinfo: [
                            {
                                thumburl:
                                    'https://upload.wikimedia.org/unknown-credit.jpg',
                                thumbwidth: 800,
                                thumbheight: 600,
                                mime: 'image/jpeg',
                                descriptionurl:
                                    'https://commons.wikimedia.org/wiki/File:UnknownCredit.jpg',
                                extmetadata: {
                                    Artist: { value: 'Unknown' },
                                    LicenseShortName: { value: 'CC BY 4.0' },
                                },
                            },
                        ],
                    },
                },
            },
        });

        expect(result).toEqual([
            expect.objectContaining({
                title: 'Government portrait',
                licenseName: 'GODL-India',
                rights: 'attribution',
            }),
        ]);
    });

    it('maps YouTube results to source links without pretending videos are downloadable assets', () => {
        expect(
            mapYouTubeVideos({
                items: [
                    {
                        id: { videoId: 'abc123' },
                        snippet: {
                            title: 'Modi viral reel explained',
                            channelTitle: 'Example Channel',
                            publishedAt: '2026-07-25T08:00:00Z',
                            thumbnails: {
                                medium: {
                                    url: 'https://i.ytimg.com/vi/abc123/mqdefault.jpg',
                                    width: 320,
                                    height: 180,
                                },
                            },
                        },
                    },
                ],
            })
        ).toEqual([
            expect.objectContaining({
                title: 'Modi viral reel explained',
                publisher: 'Example Channel',
                url: 'https://www.youtube.com/watch?v=abc123',
                kind: 'video',
            }),
        ]);
    });

    it('uses one stable YouTube freshness cutoff per UTC day so request caching can work', () => {
        expect(
            youtubePublishedAfter(Date.parse('2026-07-25T00:01:00.000Z'))
        ).toBe('2026-07-11T00:00:00.000Z');
        expect(
            youtubePublishedAfter(Date.parse('2026-07-25T23:59:59.999Z'))
        ).toBe('2026-07-11T00:00:00.000Z');
    });
});
