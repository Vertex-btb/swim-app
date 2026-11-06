/* ==========================================================================
   AeroSwim USA Swimming & YMCA State Motivational Time Standards View
   ========================================================================== */

import { getProfile, getTimes, timeStringToSeconds, secondsToTimeString } from './storage.js';

/**
 * Prints the Time Standards page as-is (no special formatting) fitted onto a single
 * landscape page. Uses the browser's print dialog -> "Save as PDF".
 */
export function exportStandardsPDF() {
    const PAGE_W = 998;  // printable px: 10.4in @ 96dpi (landscape letter, 0.3in margins)
    const PAGE_H = 758;  // printable px: 7.9in
    const LAYOUT_W = 1150; // px width the page is laid out at before scaling

    const style = document.createElement('style');
    style.id = 'standards-print-style';
    style.textContent = `
        @page { size: letter landscape; margin: 0.3in; }
        html, body, .app-container, .main-content, #main-viewport {
            height: auto !important; min-height: 0 !important; overflow: visible !important;
            display: block !important; margin: 0 !important; padding: 0 !important;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
        }
        .sidebar, .top-bar, .sidebar-backdrop, .no-print { display: none !important; }
        #main-viewport { width: ${LAYOUT_W}px !important; }
        #main-viewport .table-container { overflow: visible !important; }
        #main-viewport table { min-width: 0 !important; width: 100% !important; }
    `;
    document.head.appendChild(style);

    const viewport = document.getElementById('main-viewport');
    const contentH = viewport.scrollHeight;
    const scale = Math.min(PAGE_W / LAYOUT_W, PAGE_H / contentH, 1);
    style.textContent += `\n#main-viewport { zoom: ${scale.toFixed(3)}; }`;

    const cleanup = () => {
        style.remove();
        window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
}

// Helper to map numeric age to standard age brackets
export function getAgeBracketForAge(age, system = 'USA') {
    const numAge = parseInt(age) || 14;
    if (system === 'YMCA') {
        if (numAge <= 10) return "10&U";
        if (numAge <= 12) return "11-12";
        if (numAge <= 14) return "13-14";
        return "15-18";
    } else {
        if (numAge <= 10) return "10&U";
        if (numAge <= 12) return "11-12";
        if (numAge <= 14) return "13-14";
        if (numAge <= 16) return "15-16";
        return "17-18";
    }
}

// --- Cross Island & Flushing Y Holiday Invitational (December Meet) Qualifying Cuts ---
export const HOLIDAY_INVITATIONAL_CUTS = {
    "11-12": {
        "Boys": {
            "200-IM": { Cut: "2:40.00", display: "2:40.00", seconds: 160.00 },
            "200-free": { Cut: "2:25.00", display: "2:25.00", seconds: 145.00 },
            "50-back": { Cut: "37.00", display: "37.00", seconds: 37.00 },
            "100-breast": { Cut: "1:33.00", display: "1:33.00", seconds: 93.00 },
            "50-free": { Cut: "30.00", display: "30.00", seconds: 30.00 },
            "100-fly": { Cut: "1:20.00", display: "1:20.00", seconds: 80.00 }
        }
    }
};

// --- USA Swimming 2024-2028 Motivational Standards Database (SCY) ---
export const STANDARDS_DATA = {
    "10&U": {
        "Boys": {
            "50-free": { AAAA: "27.39", AAA: "28.59", AA: "29.79", A: "30.99", BB: "33.39", B: "35.89" },
            "100-free": { AAAA: "1:00.59", AAA: "1:03.69", AA: "1:06.69", A: "1:09.79", BB: "1:15.89", B: "1:21.99" },
            "200-free": { AAAA: "2:11.69", AAA: "2:17.99", AA: "2:24.19", A: "2:30.49", BB: "2:43.09", B: "2:55.59" },
            "500-free": { AAAA: "5:48.39", AAA: "6:04.99", AA: "6:21.59", A: "6:38.19", BB: "7:11.39", B: "7:44.59" },
            "50-back": { AAAA: "31.69", AAA: "33.39", AA: "34.99", A: "36.69", BB: "40.09", B: "43.49" },
            "100-back": { AAAA: "1:08.29", AAA: "1:11.79", AA: "1:15.39", A: "1:18.99", BB: "1:26.19", B: "1:33.29" },
            "50-breast": { AAAA: "35.49", AAA: "37.39", AA: "39.19", A: "41.09", BB: "44.79", B: "48.49" },
            "100-breast": { AAAA: "1:18.19", AAA: "1:22.29", AA: "1:26.49", A: "1:30.59", BB: "1:38.89", B: "1:47.19" },
            "50-fly": { AAAA: "29.89", AAA: "31.59", AA: "33.29", A: "34.99", BB: "38.39", B: "41.79" },
            "100-fly": { AAAA: "1:07.49", AAA: "1:11.49", AA: "1:15.49", A: "1:19.49", BB: "1:27.49", B: "1:35.49" },
            "100-IM": { AAAA: "1:09.79", AAA: "1:13.19", AA: "1:16.59", A: "1:19.99", BB: "1:26.79", B: "1:33.59" },
            "200-IM": { AAAA: "2:29.89", AAA: "2:37.49", AA: "2:45.09", A: "2:52.69", BB: "3:07.79", B: "3:22.99" }
        },
        "Girls": {
            "50-free": { AAAA: "27.69", AAA: "28.99", AA: "30.29", A: "31.59", BB: "34.19", B: "36.89" },
            "100-free": { AAAA: "1:00.99", AAA: "1:04.09", AA: "1:07.29", A: "1:10.39", BB: "1:16.79", B: "1:23.09" },
            "200-free": { AAAA: "2:13.79", AAA: "2:20.19", AA: "2:26.59", A: "2:32.99", BB: "2:45.69", B: "2:58.49" },
            "500-free": { AAAA: "5:51.99", AAA: "6:08.79", AA: "6:25.59", A: "6:42.29", BB: "7:15.89", B: "7:49.39" },
            "50-back": { AAAA: "31.79", AAA: "33.39", AA: "35.09", A: "36.69", BB: "39.99", B: "43.29" },
            "100-back": { AAAA: "1:08.69", AAA: "1:12.29", AA: "1:15.89", A: "1:19.49", BB: "1:26.69", B: "1:33.89" },
            "50-breast": { AAAA: "35.99", AAA: "37.89", AA: "39.79", A: "41.59", BB: "45.39", B: "49.09" },
            "100-breast": { AAAA: "1:18.99", AAA: "1:23.09", AA: "1:27.29", A: "1:31.39", BB: "1:39.69", B: "1:47.99" },
            "50-fly": { AAAA: "29.99", AAA: "31.69", AA: "33.39", A: "35.09", BB: "38.49", B: "41.89" },
            "100-fly": { AAAA: "1:07.99", AAA: "1:11.99", AA: "1:15.99", A: "1:19.99", BB: "1:27.99", B: "1:35.99" },
            "100-IM": { AAAA: "1:10.19", AAA: "1:13.69", AA: "1:17.19", A: "1:20.69", BB: "1:27.69", B: "1:34.69" },
            "200-IM": { AAAA: "2:31.59", AAA: "2:39.19", AA: "2:46.79", A: "2:54.39", BB: "3:09.59", B: "3:24.79" }
        }
    },
    "11-12": {
        "Boys": {
            "50-free": { AAAA: "25.79", AAA: "26.99", AA: "28.09", A: "29.29", BB: "31.69", B: "33.99" },
            "100-free": { AAAA: "55.99", AAA: "58.69", AA: "1:01.39", A: "1:03.99", BB: "1:09.39", B: "1:14.69" },
            "200-free": { AAAA: "1:56.99", AAA: "2:02.59", AA: "2:08.19", A: "2:13.69", BB: "2:24.89", B: "2:35.99" },
            "500-free": { AAAA: "5:14.99", AAA: "5:29.99", AA: "5:44.99", A: "5:59.99", BB: "6:29.99", B: "6:59.89" },
            "50-back": { AAAA: "29.09", AAA: "30.49", AA: "31.89", A: "33.29", BB: "36.09", B: "38.79" },
            "100-back": { AAAA: "1:02.69", AAA: "1:06.19", AA: "1:09.59", A: "1:12.99", BB: "1:19.79", B: "1:26.59" },
            "200-back": { AAAA: "2:10.19", AAA: "2:16.29", AA: "2:22.49", A: "2:28.59", BB: "2:40.89", B: "2:53.19" },
            "50-breast": { AAAA: "32.99", AAA: "34.59", AA: "36.19", A: "37.69", BB: "40.89", B: "43.99" },
            "100-breast": { AAAA: "1:11.49", AAA: "1:15.09", AA: "1:18.59", A: "1:22.19", BB: "1:29.29", B: "1:36.49" },
            "200-breast": { AAAA: "2:29.49", AAA: "2:36.59", AA: "2:43.79", A: "2:50.89", BB: "3:05.19", B: "3:19.49" },
            "50-fly": { AAAA: "27.69", AAA: "28.99", AA: "30.29", A: "31.59", BB: "34.29", B: "36.89" },
            "100-fly": { AAAA: "1:00.89", AAA: "1:05.89", AA: "1:10.89", A: "1:15.99", BB: "1:20.99", B: "1:26.09" },
            "200-fly": { AAAA: "2:20.19", AAA: "2:26.79", AA: "2:33.49", A: "2:40.09", BB: "2:53.39", B: "3:06.69" },
            "100-IM": { AAAA: "1:06.49", AAA: "1:09.69", AA: "1:12.79", A: "1:15.99", BB: "1:22.29", B: "1:28.69" },
            "200-IM": { AAAA: "2:21.99", AAA: "2:29.29", AA: "2:36.49", A: "2:43.69", BB: "2:58.19", B: "3:12.99" }
        },
        "Girls": {
            "50-free": { AAAA: "25.79", AAA: "26.99", AA: "28.09", A: "29.29", BB: "31.69", B: "33.99" },
            "100-free": { AAAA: "55.99", AAA: "58.69", AA: "1:01.39", A: "1:03.99", BB: "1:09.39", B: "1:14.69" },
            "200-free": { AAAA: "2:01.89", AAA: "2:07.69", AA: "2:13.49", A: "2:19.29", BB: "2:30.89", B: "2:42.59" },
            "500-free": { AAAA: "5:27.69", AAA: "5:43.29", AA: "5:58.89", A: "6:14.49", BB: "6:45.69", B: "7:16.89" },
            "50-back": { AAAA: "29.09", AAA: "30.49", AA: "31.89", A: "33.29", BB: "36.09", B: "38.79" },
            "100-back": { AAAA: "1:02.69", AAA: "1:06.19", AA: "1:09.59", A: "1:12.99", BB: "1:19.79", B: "1:26.59" },
            "200-back": { AAAA: "2:14.59", AAA: "2:20.99", AA: "2:27.49", A: "2:33.89", BB: "2:46.69", B: "2:59.49" },
            "50-breast": { AAAA: "32.99", AAA: "34.59", AA: "36.19", A: "37.69", BB: "40.89", B: "43.99" },
            "100-breast": { AAAA: "1:11.49", AAA: "1:15.09", AA: "1:18.69", A: "1:22.19", BB: "1:29.39", B: "1:36.49" },
            "200-breast": { AAAA: "2:36.19", AAA: "2:43.69", AA: "2:51.19", A: "2:58.69", BB: "3:13.59", B: "3:28.49" },
            "50-fly": { AAAA: "27.69", AAA: "28.99", AA: "30.29", A: "31.59", BB: "34.29", B: "36.89" },
            "100-fly": { AAAA: "1:00.89", AAA: "1:05.89", AA: "1:10.89", A: "1:15.99", BB: "1:20.99", B: "1:26.09" },
            "200-fly": { AAAA: "2:25.69", AAA: "2:32.59", AA: "2:39.59", A: "2:46.49", BB: "3:00.39", B: "3:14.29" },
            "100-IM": { AAAA: "1:06.49", AAA: "1:09.69", AA: "1:12.79", A: "1:15.99", BB: "1:22.29", B: "1:28.69" },
            "200-IM": { AAAA: "2:24.59", AAA: "2:31.49", AA: "2:38.39", A: "2:45.19", BB: "2:58.99", B: "3:12.79" }
        }
    },
    "13-14": {
        "Boys": {
            "50-free": { AAAA: "22.39", AAA: "23.49", AA: "24.39", A: "25.59", BB: "27.69", B: "29.89" },
            "100-free": { AAAA: "48.99", AAA: "51.29", AA: "53.59", A: "55.89", BB: "1:00.59", B: "1:05.19" },
            "200-free": { AAAA: "1:46.89", AAA: "1:51.99", AA: "1:57.09", A: "2:02.19", BB: "2:12.29", B: "2:22.49" },
            "500-free": { AAAA: "4:49.29", AAA: "5:03.09", AA: "5:16.89", A: "5:30.59", BB: "5:58.19", B: "6:25.69" },
            "100-back": { AAAA: "57.69", AAA: "1:00.39", AA: "1:03.09", A: "1:05.79", BB: "1:11.29", B: "1:16.89" },
            "200-back": { AAAA: "2:05.29", AAA: "2:11.29", AA: "2:17.29", A: "2:23.19", BB: "2:35.19", B: "2:47.09" },
            "100-breast": { AAAA: "1:06.19", AAA: "1:09.39", AA: "1:12.59", A: "1:15.79", BB: "1:22.19", B: "1:28.69" },
            "200-breast": { AAAA: "2:22.89", AAA: "2:29.69", AA: "2:36.49", A: "2:43.29", BB: "2:56.99", B: "3:10.59" },
            "100-fly": { AAAA: "57.29", AAA: "1:00.09", AA: "1:02.79", A: "1:05.59", BB: "1:11.19", B: "1:16.79" },
            "200-fly": { AAAA: "2:06.99", AAA: "2:12.99", AA: "2:19.09", A: "2:25.09", BB: "2:37.19", B: "2:49.29" },
            "200-IM": { AAAA: "2:03.69", AAA: "2:09.69", AA: "2:15.69", A: "2:21.69", BB: "2:32.49", B: "2:45.19" }
        },
        "Girls": {
            "50-free": { AAAA: "24.39", AAA: "25.59", AA: "26.69", A: "27.89", BB: "30.19", B: "32.49" },
            "100-free": { AAAA: "53.29", AAA: "55.79", AA: "58.29", A: "1:00.89", BB: "1:05.89", B: "1:10.99" },
            "200-free": { AAAA: "1:55.29", AAA: "2:00.69", AA: "2:06.19", A: "2:11.69", BB: "2:22.69", B: "2:33.59" },
            "500-free": { AAAA: "5:09.19", AAA: "5:23.89", AA: "5:38.59", A: "5:53.39", BB: "6:22.79", B: "6:52.19" },
            "100-back": { AAAA: "57.99", AAA: "1:00.69", AA: "1:03.39", A: "1:06.09", BB: "1:11.49", B: "1:16.89" },
            "200-back": { AAAA: "2:05.99", AAA: "2:11.99", AA: "2:17.99", A: "2:23.99", BB: "2:35.99", B: "2:47.99" },
            "100-breast": { AAAA: "1:06.99", AAA: "1:10.09", AA: "1:13.19", A: "1:16.29", BB: "1:22.49", B: "1:28.69" },
            "200-breast": { AAAA: "2:24.49", AAA: "2:31.29", AA: "2:38.19", A: "2:45.09", BB: "2:58.79", B: "3:12.59" },
            "100-fly": { AAAA: "58.19", AAA: "1:00.89", AA: "1:03.49", A: "1:06.19", BB: "1:11.49", B: "1:16.79" },
            "200-fly": { AAAA: "2:08.99", AAA: "2:15.19", AA: "2:21.29", A: "2:27.49", BB: "2:39.79", B: "2:52.09" },
            "200-IM": { AAAA: "2:13.39", AAA: "2:20.39", AA: "2:27.39", A: "2:34.39", BB: "2:41.39", B: "2:48.39" }
        }
    },
    "15-16": {
        "Boys": {
            "50-free": { AAAA: "21.09", AAA: "22.09", AA: "23.09", A: "24.09", BB: "26.09", B: "28.09" },
            "100-free": { AAAA: "45.99", AAA: "48.19", AA: "50.39", A: "52.59", BB: "56.99", B: "1:01.39" },
            "200-free": { AAAA: "1:40.89", AAA: "1:45.69", AA: "1:50.49", A: "1:55.29", BB: "2:04.89", B: "2:14.49" },
            "500-free": { AAAA: "4:34.99", AAA: "4:48.09", AA: "5:01.19", A: "5:14.29", BB: "5:40.49", B: "6:06.69" },
            "100-back": { AAAA: "50.99", AAA: "53.39", AA: "55.79", A: "58.19", BB: "1:03.09", B: "1:07.89" },
            "200-back": { AAAA: "1:51.99", AAA: "1:57.29", AA: "2:02.59", A: "2:07.99", BB: "2:18.59", B: "2:29.29" },
            "100-breast": { AAAA: "57.99", AAA: "1:00.79", AA: "1:03.59", A: "1:06.39", BB: "1:11.89", B: "1:17.39" },
            "200-breast": { AAAA: "2:05.99", AAA: "2:11.99", AA: "2:17.99", A: "2:23.99", BB: "2:35.99", B: "2:47.99" },
            "100-fly": { AAAA: "50.29", AAA: "52.69", AA: "55.09", A: "57.49", BB: "1:02.29", B: "1:07.09" },
            "200-fly": { AAAA: "1:52.99", AAA: "1:58.39", AA: "2:03.79", A: "2:09.19", BB: "2:19.99", B: "2:30.79" },
            "200-IM": { AAAA: "1:52.99", AAA: "1:58.39", AA: "2:03.79", A: "2:09.19", BB: "2:19.99", B: "2:30.79" }
        },
        "Girls": {
            "50-free": { AAAA: "23.39", AAA: "24.49", AA: "25.59", A: "26.69", BB: "28.89", B: "31.09" },
            "100-free": { AAAA: "50.99", AAA: "53.39", AA: "55.79", A: "58.19", BB: "1:03.09", B: "1:07.89" },
            "200-free": { AAAA: "1:50.99", AAA: "1:56.29", AA: "2:01.59", A: "2:06.89", BB: "2:17.49", B: "2:27.99" },
            "500-free": { AAAA: "4:57.99", AAA: "5:12.19", AA: "5:26.39", A: "5:40.59", BB: "6:08.99", B: "6:37.29" },
            "100-back": { AAAA: "55.99", AAA: "58.69", AA: "1:01.39", A: "1:03.99", BB: "1:09.39", B: "1:14.69" },
            "200-back": { AAAA: "2:00.99", AAA: "2:06.79", AA: "2:12.59", A: "2:18.39", BB: "2:29.89", B: "2:41.49" },
            "100-breast": { AAAA: "1:03.99", AAA: "1:06.99", AA: "1:09.99", A: "1:12.99", BB: "1:18.99", B: "1:24.99" },
            "200-breast": { AAAA: "2:18.99", AAA: "2:25.59", AA: "2:32.19", A: "2:38.79", BB: "2:51.99", B: "3:05.19" },
            "100-fly": { AAAA: "55.99", AAA: "58.69", AA: "1:01.39", A: "1:03.99", BB: "1:09.39", B: "1:14.69" },
            "200-fly": { AAAA: "2:03.99", AAA: "2:09.89", AA: "2:15.89", A: "2:21.89", BB: "2:33.69", B: "2:45.49" },
            "200-IM": { AAAA: "2:04.99", AAA: "2:10.99", AA: "2:16.89", A: "2:22.89", BB: "2:34.79", B: "2:46.69" }
        }
    },
    "17-18": {
        "Boys": {
            "50-free": { AAAA: "20.39", AAA: "21.39", AA: "22.39", A: "23.39", BB: "25.39", B: "27.39" },
            "100-free": { AAAA: "44.59", AAA: "46.69", AA: "48.79", A: "50.89", BB: "55.19", B: "59.39" },
            "200-free": { AAAA: "1:37.99", AAA: "1:42.69", AA: "1:47.39", A: "1:52.09", BB: "2:01.39", B: "2:10.79" },
            "500-free": { AAAA: "4:26.99", AAA: "4:39.69", AA: "4:52.39", A: "5:05.09", BB: "5:30.49", B: "5:55.89" },
            "100-back": { AAAA: "48.99", AAA: "51.29", AA: "53.59", A: "55.89", BB: "1:00.59", B: "1:05.19" },
            "200-back": { AAAA: "1:46.99", AAA: "1:52.09", AA: "1:57.29", A: "2:02.39", BB: "2:12.59", B: "2:22.79" },
            "100-breast": { AAAA: "55.99", AAA: "58.69", AA: "1:01.39", A: "1:03.99", BB: "1:09.39", B: "1:14.69" },
            "200-breast": { AAAA: "2:01.99", AAA: "2:07.79", AA: "2:13.59", A: "2:19.39", BB: "2:31.09", B: "2:42.69" },
            "100-fly": { AAAA: "48.99", AAA: "51.29", AA: "53.59", A: "55.89", BB: "1:00.59", B: "1:05.19" },
            "200-fly": { AAAA: "1:48.99", AAA: "1:54.19", AA: "1:59.39", A: "2:04.59", BB: "2:14.99", B: "2:25.39" },
            "200-IM": { AAAA: "1:48.99", AAA: "1:54.19", AA: "1:59.39", A: "2:04.59", BB: "2:14.99", B: "2:25.39" }
        },
        "Girls": {
            "50-free": { AAAA: "22.99", AAA: "24.09", AA: "25.19", A: "26.29", BB: "28.49", B: "30.69" },
            "100-free": { AAAA: "49.99", AAA: "52.39", AA: "54.79", A: "57.19", BB: "1:01.99", B: "1:06.69" },
            "200-free": { AAAA: "1:48.99", AAA: "1:54.19", AA: "1:59.39", A: "2:04.59", BB: "2:14.99", B: "2:25.39" },
            "500-free": { AAAA: "4:51.99", AAA: "5:05.89", AA: "5:19.79", A: "5:33.69", BB: "6:01.49", B: "6:29.29" },
            "100-back": { AAAA: "54.99", AAA: "57.59", AA: "1:00.29", A: "1:02.89", BB: "1:08.19", B: "1:13.39" },
            "200-back": { AAAA: "1:58.99", AAA: "2:04.69", AA: "2:10.39", A: "2:16.09", BB: "2:27.49", B: "2:38.79" },
            "100-breast": { AAAA: "1:02.99", AAA: "1:05.99", AA: "1:08.89", A: "1:11.89", BB: "1:17.89", B: "1:23.89" },
            "200-breast": { AAAA: "2:15.99", AAA: "2:22.49", AA: "2:28.99", A: "2:35.49", BB: "2:48.49", B: "3:01.39" },
            "100-fly": { AAAA: "54.99", AAA: "57.59", AA: "1:00.29", A: "1:02.89", BB: "1:08.19", B: "1:13.39" },
            "200-fly": { AAAA: "2:01.99", AAA: "2:07.79", AA: "2:13.59", A: "2:19.39", BB: "2:31.09", B: "2:42.79" },
            "200-IM": { AAAA: "2:01.99", AAA: "2:07.79", AA: "2:13.59", A: "2:19.39", BB: "2:31.09", B: "2:42.79" }
        }
    }
};

// --- NJ YMCA State Championships 2025-2026 Qualifying Standards (SCY) ---
export const YMCA_STANDARDS_DATA = {
    "10&U": {
        "Boys": {
            "50-free": { State: "32.99", Silver: "35.99", Bronze: "42.99" },
            "100-free": { State: "1:14.99", Silver: "1:20.99", Bronze: "1:35.99" },
            "200-free": { State: "2:44.99", Silver: "2:58.99", Bronze: "3:15.99" },
            "50-back": { State: "38.99", Silver: "42.99", Bronze: "51.99" },
            "100-back": { State: "1:25.99", Silver: "1:33.99", Bronze: "1:48.99" },
            "50-breast": { State: "43.99", Silver: "48.99", Bronze: "58.99" },
            "100-breast": { State: "1:37.99", Silver: "1:47.99", Bronze: "2:05.00" },
            "50-fly": { State: "37.99", Silver: "42.99", Bronze: "54.99" },
            "100-fly": { State: "1:31.99", Silver: "1:44.99", Bronze: "2:00.00" },
            "100-IM": { State: "1:24.99", Silver: "1:33.99", Bronze: "1:48.99" },
            "200-IM": { State: "3:04.99", Silver: "3:22.99", Bronze: "3:45.99" }
        },
        "Girls": {
            "50-free": { State: "33.49", Silver: "35.99", Bronze: "41.99" },
            "100-free": { State: "1:14.99", Silver: "1:20.99", Bronze: "1:32.99" },
            "200-free": { State: "2:44.99", Silver: "2:56.99", Bronze: "3:15.99" },
            "50-back": { State: "38.99", Silver: "41.99", Bronze: "49.99" },
            "100-back": { State: "1:24.99", Silver: "1:30.99", Bronze: "1:45.99" },
            "50-breast": { State: "43.99", Silver: "47.99", Bronze: "56.99" },
            "100-breast": { State: "1:36.99", Silver: "1:45.99", Bronze: "2:02.00" },
            "50-fly": { State: "37.49", Silver: "41.99", Bronze: "52.99" },
            "100-fly": { State: "1:30.99", Silver: "1:42.99", Bronze: "1:58.00" },
            "100-IM": { State: "1:23.99", Silver: "1:30.99", Bronze: "1:45.99" },
            "200-IM": { State: "3:02.99", Silver: "3:20.99", Bronze: "3:40.99" }
        }
    },
    "11-12": {
        "Boys": {
            "50-free": { State: "29.49", Silver: "30.99", Bronze: "37.99" },
            "100-free": { State: "1:04.09", Silver: "1:08.29", Bronze: "1:22.99" },
            "200-free": { State: "2:20.44", Silver: "2:32.09", Bronze: "2:40.99" },
            "500-free": { State: "6:18.69", Silver: "6:45.99", Bronze: "7:10.99" },
            "50-back": { State: "34.29", Silver: "37.29", Bronze: "46.99" },
            "100-back": { State: "1:15.79", Silver: "1:19.99", Bronze: "1:35.99" },
            "200-back": { State: "2:39.99", Silver: "2:53.99", Bronze: "3:05.99" },
            "50-breast": { State: "38.40", Silver: "42.59", Bronze: "51.99" },
            "100-breast": { State: "1:23.79", Silver: "1:30.99", Bronze: "1:55.00" },
            "200-breast": { State: "3:05.29", Silver: "3:18.99", Bronze: "3:25.99" },
            "50-fly": { State: "33.39", Silver: "36.19", Bronze: "49.99" },
            "100-fly": { State: "1:16.99", Silver: "1:28.49", Bronze: "1:45.99" },
            "200-fly": { State: "2:55.99", Silver: "3:15.99", Bronze: "3:20.99" },
            "100-IM": { State: "1:14.49", Silver: "1:19.99", Bronze: "1:35.99" },
            "200-IM": { State: "2:39.99", Silver: "2:49.99", Bronze: "3:22.99" }
        },
        "Girls": {
            "50-free": { State: "29.99", Silver: "31.49", Bronze: "36.99" },
            "100-free": { State: "1:04.99", Silver: "1:08.79", Bronze: "1:21.99" },
            "200-free": { State: "2:20.29", Silver: "2:28.99", Bronze: "2:40.99" },
            "500-free": { State: "6:20.99", Silver: "6:40.99", Bronze: "7:10.99" },
            "50-back": { State: "34.29", Silver: "36.29", Bronze: "42.99" },
            "100-back": { State: "1:13.99", Silver: "1:17.59", Bronze: "1:30.99" },
            "200-back": { State: "2:39.99", Silver: "2:52.99", Bronze: "3:00.99" },
            "50-breast": { State: "37.99", Silver: "41.59", Bronze: "48.99" },
            "100-breast": { State: "1:25.79", Silver: "1:32.79", Bronze: "1:55.00" },
            "200-breast": { State: "3:01.99", Silver: "3:15.99", Bronze: "3:20.99" },
            "50-fly": { State: "32.29", Silver: "35.09", Bronze: "46.99" },
            "100-fly": { State: "1:16.79", Silver: "1:23.19", Bronze: "1:40.99" },
            "200-fly": { State: "2:53.99", Silver: "3:15.99", Bronze: "3:20.99" },
            "100-IM": { State: "1:12.89", Silver: "1:18.39", Bronze: "1:30.99" },
            "200-IM": { State: "2:39.99", Silver: "2:49.49", Bronze: "3:16.99" }
        }
    },
    "13-14": {
        "Boys": {
            "50-free": { State: "25.29", Silver: "26.79", Bronze: "30.49" },
            "100-free": { State: "54.59", Silver: "58.59", Bronze: "1:15.99" },
            "200-free": { State: "2:00.19", Silver: "2:07.39", Bronze: "2:26.99" },
            "500-free": { State: "5:25.99", Silver: "5:45.99", Bronze: "6:10.99" },
            "100-back": { State: "1:03.19", Silver: "1:07.79", Bronze: "1:32.99" },
            "200-back": { State: "2:17.89", Silver: "2:29.89", Bronze: "2:58.99" },
            "100-breast": { State: "1:11.69", Silver: "1:16.69", Bronze: "1:32.49" },
            "200-breast": { State: "2:34.19", Silver: "2:47.49", Bronze: "3:18.99" },
            "100-fly": { State: "1:02.29", Silver: "1:06.99", Bronze: "1:29.99" },
            "200-fly": { State: "2:22.99", Silver: "2:46.99", Bronze: "3:19.99" },
            "200-IM": { State: "2:14.99", Silver: "2:23.79", Bronze: "2:48.99" }
        },
        "Girls": {
            "50-free": { State: "27.09", Silver: "28.19", Bronze: "31.99" },
            "100-free": { State: "57.99", Silver: "1:00.99", Bronze: "1:10.99" },
            "200-free": { State: "2:05.99", Silver: "2:12.49", Bronze: "2:32.99" },
            "500-free": { State: "5:40.99", Silver: "5:59.99", Bronze: "6:15.99" },
            "100-back": { State: "1:05.79", Silver: "1:08.99", Bronze: "1:27.99" },
            "200-back": { State: "2:21.29", Silver: "2:27.49", Bronze: "2:55.99" },
            "100-breast": { State: "1:15.29", Silver: "1:19.89", Bronze: "1:40.99" },
            "200-breast": { State: "2:44.19", Silver: "2:55.99", Bronze: "3:19.99" },
            "100-fly": { State: "1:05.29", Silver: "1:09.59", Bronze: "1:29.99" },
            "200-fly": { State: "2:30.79", Silver: "2:46.99", Bronze: "3:19.99" },
            "200-IM": { State: "2:23.59", Silver: "2:30.19", Bronze: "2:55.99" }
        }
    },
    "15-18": {
        "Boys": {
            "50-free": { State: "23.29", Silver: "24.79", Bronze: "28.99" },
            "100-free": { State: "50.99", Silver: "54.59", Bronze: "1:08.99" },
            "200-free": { State: "1:52.49", Silver: "1:59.99", Bronze: "2:18.99" },
            "500-free": { State: "5:04.99", Silver: "5:25.99", Bronze: "5:55.99" },
            "100-back": { State: "58.49", Silver: "1:02.99", Bronze: "1:25.99" },
            "200-back": { State: "2:08.99", Silver: "2:19.99", Bronze: "2:48.99" },
            "100-breast": { State: "1:05.49", Silver: "1:10.99", Bronze: "1:28.99" },
            "200-breast": { State: "2:22.99", Silver: "2:35.99", Bronze: "3:08.99" },
            "100-fly": { State: "56.49", Silver: "1:01.99", Bronze: "1:22.99" },
            "200-fly": { State: "2:10.99", Silver: "2:28.99", Bronze: "3:08.99" },
            "200-IM": { State: "2:05.99", Silver: "2:14.99", Bronze: "2:38.99" }
        },
        "Girls": {
            "50-free": { State: "25.99", Silver: "27.29", Bronze: "30.99" },
            "100-free": { State: "56.49", Silver: "59.29", Bronze: "1:08.99" },
            "200-free": { State: "2:02.49", Silver: "2:08.99", Bronze: "2:28.99" },
            "500-free": { State: "5:30.99", Silver: "5:48.99", Bronze: "6:08.99" },
            "100-back": { State: "1:03.49", Silver: "1:06.99", Bronze: "1:24.99" },
            "200-back": { State: "2:17.99", Silver: "2:24.99", Bronze: "2:49.99" },
            "100-breast": { State: "1:12.99", Silver: "1:17.99", Bronze: "1:36.99" },
            "200-breast": { State: "2:37.99", Silver: "2:49.99", Bronze: "3:12.99" },
            "100-fly": { State: "1:02.99", Silver: "1:07.29", Bronze: "1:25.99" },
            "200-fly": { State: "2:22.99", Silver: "2:38.99", Bronze: "3:08.99" },
            "200-IM": { State: "2:17.99", Silver: "2:25.99", Bronze: "2:49.99" }
        }
    }
};

export const TIER_ORDER = ["AAAA", "AAA", "AA", "A", "BB", "B"];
export const YMCA_TIER_ORDER = ["State", "Silver", "Bronze"];

/**
 * Returns color classes for the standard badges
 */
export function getBadgeColorClass(level) {
    switch (level) {
        case 'AAAA': case 'State': return 'badge-aaaa'; // Gold/Purple
        case 'AAA': return 'badge-aaa';
        case 'AA': case 'Silver': return 'badge-aa';   // Blue/Silver
        case 'A': return 'badge-a';
        case 'BB': case 'Bronze': return 'badge-bb';   // Amber/Bronze
        case 'B': return 'badge-b';
        default: return 'badge-none';
    }
}

/**
 * Helper to determine which level standard is reached
 */
export function getAchievedStandard(prSeconds, eventCuts, tiers = TIER_ORDER) {
    if (!prSeconds || isNaN(prSeconds)) return "None";
    
    // Check from fastest tier down to slowest
    for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        if (!eventCuts[tier]) continue;
        const cutSecs = timeStringToSeconds(eventCuts[tier]);
        if (prSeconds <= cutSecs) {
            return tier;
        }
    }
    return "None";
}

/// Track state globally so selection persists across toggles
let currentSystem = 'USA'; // 'USA' or 'YMCA'
let selectedAgeBracket = null; // null = auto-detect from Swimmer Profile age
let selectedGender = null; // null = auto-detect from Swimmer Profile gender
let sortColumn = 'event';   // 'event', 'tier', 'closest'
let sortAsc = true;

export async function initStandardsView() {
    const container = document.getElementById('main-viewport');
    
    const profile = getProfile();
    const times = await getTimes();
    
    // Determine effective age bracket & gender (supports profile auto-detection + manual dropdown override)
    const autoAgeBracket = getAgeBracketForAge(profile.age, currentSystem);
    const ageBracket = selectedAgeBracket || autoAgeBracket;
    const gender = selectedGender || profile.gender || "Boys";
    
    // Select correct database and active tiers
    const cutsDatabase = currentSystem === 'USA' ? STANDARDS_DATA : YMCA_STANDARDS_DATA;
    const activeTiers = currentSystem === 'USA' ? TIER_ORDER : YMCA_TIER_ORDER;
    
    // Fallback if bracket doesn't exist in selected database
    const availableBrackets = Object.keys(cutsDatabase);
    const validAgeBracket = cutsDatabase[ageBracket] ? ageBracket : availableBrackets[0];
    const cuts = cutsDatabase[validAgeBracket][gender] || cutsDatabase[validAgeBracket]["Boys"];
    
    // 2. Fetch the Swimmer's PR for each event in Short Course Yards (SCY)
    const scyTimes = times.filter(t => t.course === 'SCY');
    const prMap = {};
    Object.keys(cuts).forEach(eventKey => {
        const eventTimes = scyTimes.filter(t => t.event === eventKey);
        if (eventTimes.length > 0) {
            let fastest = eventTimes[0];
            eventTimes.forEach(t => {
                if (timeStringToSeconds(t.time) < timeStringToSeconds(fastest.time)) {
                    fastest = t;
                }
            });
            prMap[eventKey] = fastest.time;
        } else {
            prMap[eventKey] = null;
        }
    });

    // 3. Pre-process the list of events for sorting
    const eventList = Object.keys(cuts).map(eventKey => {
        const eventCuts = cuts[eventKey];
        const pr = prMap[eventKey];
        const eventText = eventKey.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        
        let prSecs = pr ? timeStringToSeconds(pr) : null;
        let levelAchieved = pr ? getAchievedStandard(prSecs, eventCuts, activeTiers) : 'None';
        
        // Calculate margin to next cut
        let marginToNext = 9999; // no PR
        let nextTierLabel = "Achieved Max";
        let targetCutTime = null;
        
        if (prSecs && !isNaN(prSecs)) {
            // Find current tier index
            const currentTierIdx = activeTiers.indexOf(levelAchieved);
            let targetTierIdx = -1;
            
            if (currentTierIdx === -1) {
                // Not achieved any cut yet, target is the lowest tier
                targetTierIdx = activeTiers.length - 1;
            } else if (currentTierIdx > 0) {
                // Target is the next tier up
                targetTierIdx = currentTierIdx - 1;
            }
            
            if (targetTierIdx !== -1) {
                const targetTier = activeTiers[targetTierIdx];
                if (eventCuts[targetTier]) {
                    const targetSecs = timeStringToSeconds(eventCuts[targetTier]);
                    marginToNext = prSecs - targetSecs;
                    nextTierLabel = targetTier;
                    targetCutTime = eventCuts[targetTier];
                }
            }
        }
        
        return {
            key: eventKey,
            name: eventText,
            pr: pr,
            prSecs: prSecs,
            levelAchieved: levelAchieved,
            marginToNext: marginToNext,
            nextTierLabel: nextTierLabel,
            targetCutTime: targetCutTime,
            cuts: eventCuts
        };
    });

    // Sort the list based on state
    eventList.sort((a, b) => {
        let comp = 0;
        if (sortColumn === 'event') {
            comp = a.name.localeCompare(b.name);
        } else if (sortColumn === 'closest') {
            comp = a.marginToNext - b.marginToNext;
        } else if (sortColumn === 'tier') {
            const idxA = activeTiers.indexOf(a.levelAchieved);
            const idxB = activeTiers.indexOf(b.levelAchieved);
            const valA = idxA === -1 ? 99 : idxA;
            const valB = idxB === -1 ? 99 : idxB;
            comp = valA - valB;
        }
        return sortAsc ? comp : -comp;
    });

    // 4. Build Progress Summary Cards
    const tierCounts = {};
    activeTiers.forEach(t => tierCounts[t] = 0);
    tierCounts['None'] = 0;
    
    eventList.forEach(item => {
        tierCounts[item.levelAchieved] = (tierCounts[item.levelAchieved] || 0) + 1;
    });

    let progressCardsHtml = '';
    activeTiers.forEach(tier => {
        const count = tierCounts[tier] || 0;
        const badgeClass = getBadgeColorClass(tier);
        progressCardsHtml += `
            <div class="stat-card" style="padding: 16px;">
                <div class="stat-icon" style="width: 40px; height: 40px;">
                    <span class="badge ${badgeClass}" style="font-size: 11px; padding: 4px 8px;">${tier}</span>
                </div>
                <div class="stat-info">
                    <span class="stat-label" style="font-size: 11px;">${tier} Cuts</span>
                    <span class="stat-value" style="font-size: 20px;">${count}</span>
                </div>
            </div>
        `;
    });

    // 5. Generate Table Rows
    let eventRowsHtml = '';
    eventList.forEach(item => {
        const badgeClass = getBadgeColorClass(item.levelAchieved);
        let nextCutText = '<span style="color: var(--accent-green); font-weight: 700;">🏆 Target cut achieved!</span>';
        
        if (item.nextTierLabel !== "Achieved Max") {
            if (item.pr) {
                if (item.marginToNext > 0) {
                    nextCutText = `<span style="color: var(--text-secondary); font-size: 12px;">Need <strong>-${item.marginToNext.toFixed(2)}s</strong> for <span class="badge ${getBadgeColorClass(item.nextTierLabel)}" style="font-size: 10px; padding: 2px 6px;">${item.nextTierLabel}</span> (${item.targetCutTime})</span>`;
                } else {
                    nextCutText = `<span style="color: var(--accent-green); font-weight: 600; font-size: 12px;">Achieved ${item.nextTierLabel}!</span>`;
                }
            } else {
                nextCutText = `<span style="color: var(--text-muted); font-size: 12px;">No PR logged for event</span>`;
            }
        }

        let cutsCellsHtml = '';
        activeTiers.forEach(tier => {
            const cutVal = item.cuts[tier] || '--';
            const isCutReached = item.prSecs && (item.prSecs <= timeStringToSeconds(cutVal));
            const highlightStyle = isCutReached ? 'font-weight: 700; color: #fff;' : 'color: var(--text-muted);';
            cutsCellsHtml += `
                <td style="text-align: center; font-family: monospace; font-size: 13px; ${highlightStyle}">
                    ${cutVal}
                    ${isCutReached ? ' ✓' : ''}
                </td>
            `;
        });

        eventRowsHtml += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                <td style="font-weight: 700; font-family: 'Outfit'; color: var(--text-primary);">
                    ${item.name}
                </td>
                <td style="font-family: monospace; font-weight: 700; color: ${item.pr ? 'var(--accent-cyan)' : 'var(--text-muted)'};">
                    ${item.pr ? item.pr : '--:--.--'}
                </td>
                <td style="text-align: center;">
                    <span class="badge ${badgeClass}" style="font-size: 11px;">${item.levelAchieved}</span>
                </td>
                ${cutsCellsHtml}
            </tr>
        `;
    });

    const getSortIcon = (col) => {
        if (sortColumn !== col) return '↕';
        return sortAsc ? '↑' : '↓';
    };

    let tableHeadersHtml = `
        <th id="sort-event" style="width: 18%; cursor: pointer; user-select: none;" title="Sort by Event Name">
            Event ${getSortIcon('event')}
        </th>
        <th id="sort-closest" style="width: 22%; cursor: pointer; user-select: none;" title="Sort by Swimmer PR & Target Gap">
            Colin's PR & Goal ${getSortIcon('closest')}
        </th>
        <th id="sort-tier" style="width: 11%; text-align: center; cursor: pointer; user-select: none;" title="Sort by Achieved Level">
            Current Tier ${getSortIcon('tier')}
        </th>
    `;
    
    activeTiers.forEach(tier => {
        let colorVar = `var(--badge-${tier.toLowerCase()}-color)`;
        if (currentSystem === 'YMCA') {
            if (tier === 'State') colorVar = 'var(--badge-aaaa-color)';
            if (tier === 'Silver') colorVar = 'var(--badge-aa-color)';
            if (tier === 'Bronze') colorVar = 'var(--badge-bb-color)';
        }
        tableHeadersHtml += `<th style="text-align: center; color: ${colorVar};">${tier} Cut</th>`;
    });

    container.innerHTML = `
        <div class="view-content" style="animation: fadeIn var(--transition-normal);">
            <!-- Settings Card -->
            <div class="card" style="padding: 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
                    <div>
                        <h2 style="font-family: 'Outfit'; font-size: 22px; font-weight: 800; margin-bottom: 4px;">
                            Swimmer Qualifying Standard Times
                        </h2>
                        <p style="color: var(--text-secondary); font-size: 13px;">
                            Currently loaded: <strong>${validAgeBracket} ${gender} (SCY)</strong> ${selectedAgeBracket ? '(Custom Selection)' : '(Auto-synced from Profile)'}.
                        </p>
                        <div style="display: flex; gap: 16px; margin-top: 12px; font-size: 12px; flex-wrap: wrap;">
                            <a href="https://swimstandards.com/national/age-group-motivational-times" target="_blank" style="color: var(--accent-cyan); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-weight: 500; opacity: 0.85; transition: opacity var(--transition-fast);" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.85">
                                <i data-lucide="external-link" style="width: 14px; height: 14px;"></i>
                                USA Swimming Standards
                            </a>
                            <a href="https://www.gomotionapp.com/team/nnjymca/page/qualifying-times" target="_blank" style="color: #9d4edd; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-weight: 500; opacity: 0.85; transition: opacity var(--transition-fast);" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.85">
                                <i data-lucide="external-link" style="width: 14px; height: 14px;"></i>
                                YMCA Qualifying Times
                            </a>
                            <a href="https://dhy-prod.usaswimming.org/search/athlete/7F914BC71BE04C/all-times?sortBy=Newest" target="_blank" style="color: var(--accent-green); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-weight: 500; opacity: 0.85; transition: opacity var(--transition-fast);" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.85">
                                <i data-lucide="external-link" style="width: 14px; height: 14px;"></i>
                                Colin's USA Swimming Hub
                            </a>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                        <!-- System Selector -->
                        <div class="form-group" style="margin-bottom: 0; min-width: 180px;">
                            <select id="standards-system-select" style="padding: 10px 14px; border-radius: 12px; background: rgba(0,0,0,0.2); color: #fff; border: 1px solid var(--glass-border); width: 100%; font-family: 'Outfit'; font-weight: 600;">
                                <option value="USA" ${currentSystem === 'USA' ? 'selected' : ''}>USA Swimming Cuts</option>
                                <option value="YMCA" ${currentSystem === 'YMCA' ? 'selected' : ''}>NJ YMCA State Cuts</option>
                            </select>
                        </div>
                        
                        <!-- Age Bracket Toggle -->
                        <div class="form-group" style="margin-bottom: 0; min-width: 150px;">
                            <select id="standards-age-select" style="padding: 10px 14px; border-radius: 12px; background: rgba(0,0,0,0.2); color: var(--accent-cyan); border: 1px solid var(--glass-border); width: 100%; font-family: 'Outfit'; font-weight: 600;">
                                <option value="auto">Age: Auto (${autoAgeBracket})</option>
                                <option value="10&U" ${validAgeBracket === '10&U' && selectedAgeBracket ? 'selected' : ''}>10 & Under</option>
                                <option value="11-12" ${validAgeBracket === '11-12' && selectedAgeBracket ? 'selected' : ''}>11 - 12 Years</option>
                                <option value="13-14" ${validAgeBracket === '13-14' && selectedAgeBracket ? 'selected' : ''}>13 - 14 Years</option>
                                ${currentSystem === 'YMCA' ? `
                                    <option value="15-18" ${validAgeBracket === '15-18' && selectedAgeBracket ? 'selected' : ''}>15 - 18 Years</option>
                                ` : `
                                    <option value="15-16" ${validAgeBracket === '15-16' && selectedAgeBracket ? 'selected' : ''}>15 - 16 Years</option>
                                    <option value="17-18" ${validAgeBracket === '17-18' && selectedAgeBracket ? 'selected' : ''}>17 - 18 Years</option>
                                `}
                            </select>
                        </div>

                        <!-- Gender Toggle -->
                        <div class="form-group" style="margin-bottom: 0; min-width: 110px;">
                            <select id="standards-gender-select" style="padding: 10px 14px; border-radius: 12px; background: rgba(0,0,0,0.2); color: #fff; border: 1px solid var(--glass-border); width: 100%; font-family: 'Outfit'; font-weight: 600;">
                                <option value="Boys" ${gender === 'Boys' ? 'selected' : ''}>Boys</option>
                                <option value="Girls" ${gender === 'Girls' ? 'selected' : ''}>Girls</option>
                            </select>
                        </div>

                        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); padding: 10px 18px; border-radius: 12px; text-align: right;">
                            <span style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); display: block;">Standard Cycle</span>
                            <span style="font-weight: 700; font-family: 'Outfit'; color: var(--accent-cyan);" id="standard-cycle-label">
                                ${currentSystem === 'USA' ? '2024 - 2028 Quad' : '2025 - 2026 Season'}
                            </span>
                        </div>

                        <button id="standards-pdf-btn" class="btn btn-secondary no-print" style="padding: 10px 16px; background: rgba(157, 78, 237, 0.15); color: #9d4edd; border: 1px solid rgba(157, 78, 237, 0.3); font-weight: 700; border-radius: 12px;" title="Save this page as a single-page PDF">
                            <i data-lucide="file-text"></i>
                            <span>Export PDF</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Achievement Stats Grid -->
            <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));">
                ${progressCardsHtml}
            </div>

            <!-- Standards Table -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">
                        <i data-lucide="award"></i>
                        <span>Motivational Cut Comparison Matrix</span>
                    </h3>
                </div>
                <div class="table-container">
                    <table class="custom-table" style="min-width: 900px; border-collapse: separate; border-spacing: 0 4px;">
                        <thead>
                            <tr style="height: 44px; background: rgba(255,255,255,0.01);">
                                ${tableHeadersHtml}
                            </tr>
                        </thead>
                        <tbody>
                            ${eventRowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    // Safe Event Binding Helpers
    const bindClick = (id, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', handler);
    };
    const bindChange = (id, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', handler);
    };

    const toggleSort = (col) => {
        if (sortColumn === col) {
            sortAsc = !sortAsc;
        } else {
            sortColumn = col;
            sortAsc = true;
        }
        initStandardsView();
    };

    bindClick('sort-event', () => toggleSort('event'));
    bindClick('sort-closest', () => toggleSort('closest'));
    bindClick('sort-tier', () => toggleSort('tier'));

    // Dropdown selection handlers
    bindChange('standards-system-select', (e) => {
        currentSystem = e.target.value;
        if (selectedAgeBracket === '15-16' || selectedAgeBracket === '17-18') {
            if (currentSystem === 'YMCA') selectedAgeBracket = '15-18';
        } else if (selectedAgeBracket === '15-18') {
            if (currentSystem === 'USA') selectedAgeBracket = '15-16';
        }
        initStandardsView();
    });

    bindChange('standards-age-select', (e) => {
        selectedAgeBracket = e.target.value === 'auto' ? null : e.target.value;
        initStandardsView();
    });

    bindChange('standards-gender-select', (e) => {
        selectedGender = e.target.value;
        initStandardsView();
    });

    bindClick('standards-pdf-btn', exportStandardsPDF);

    lucide.createIcons();
}
