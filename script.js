// ============================================================
// BOLLYWOOD SAFAR - SPOTIFY WEB PLAYBACK SDK
// script.js
// ============================================================


// ============================================================
// SPOTIFY CONFIGURATION
// ============================================================

const CLIENT_ID = "a12dcd0710544dcfbde7e2697f937acb";

const REDIRECT_URI =
    "https://bollywood-safar-spotify-0dc7.onrender.com/callback";

const SCOPES = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-modify-playback-state",
    "user-read-playback-state"
].join(" ");


// ============================================================
// VARIABLES
// ============================================================

let currentSongIndex = 0;
let accessToken = null;
let spotifyPlayer = null;
let deviceId = null;

let isPlaying = false;
let playerReady = false;
let isLoadingSong = false;

let autoNextTriggered = false;


// ============================================================
// DOM ELEMENTS
// ============================================================

const songTitle = document.getElementById("song-title");
const artistName = document.getElementById("artist-name");
const albumName = document.getElementById("album-name");

const playButton = document.getElementById("play-btn");
const nextButton = document.getElementById("next-btn");
const previousButton = document.getElementById("prev-btn");
const shuffleButton = document.getElementById("shuffle-btn");

const progressBar = document.getElementById("progress-bar");
const currentTimeEl = document.getElementById("current-time");
const durationEl = document.getElementById("duration");

const loginButton = document.getElementById("login-btn");


// ============================================================
// CHECK SONG LIST
// ============================================================

if (
    typeof songs === "undefined" ||
    !Array.isArray(songs) ||
    songs.length === 0
) {
    console.error("songs.js was not loaded or contains no songs.");

    if (songTitle) {
        songTitle.textContent = "No songs found";
    }

    if (artistName) {
        artistName.textContent = "Check songs.js";
    }
}


// ============================================================
// PKCE FUNCTIONS
// ============================================================

function generateRandomString(length) {
    const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    let result = "";

    for (let i = 0; i < length; i++) {
        result += characters.charAt(
            Math.floor(Math.random() * characters.length)
        );
    }

    return result;
}


async function sha256(value) {
    const encoder = new TextEncoder();
    const data = encoder.encode(value);

    return window.crypto.subtle.digest(
        "SHA-256",
        data
    );
}


function base64UrlEncode(buffer) {
    const bytes = new Uint8Array(buffer);

    let string = "";

    for (const byte of bytes) {
        string += String.fromCharCode(byte);
    }

    return btoa(string)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}


// ============================================================
// LOGIN WITH SPOTIFY
// ============================================================

async function loginWithSpotify() {

    console.log("Starting Spotify login...");

    const verifier = generateRandomString(64);

    const challenge = base64UrlEncode(
        await sha256(verifier)
    );

    sessionStorage.setItem(
        "spotify_code_verifier",
        verifier
    );

    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: "code",
        redirect_uri: REDIRECT_URI,
        scope: SCOPES,
        code_challenge_method: "S256",
        code_challenge: challenge
    });

    window.location.href =
        "https://accounts.spotify.com/authorize?" +
        params.toString();
}


// ============================================================
// EXCHANGE CODE FOR ACCESS TOKEN
// ============================================================

async function exchangeCodeForToken(code) {

    const verifier =
        sessionStorage.getItem(
            "spotify_code_verifier"
        );

    if (!verifier) {
        showError(
            "Login session expired. Please login again."
        );
        return;
    }

    try {

        const response = await fetch(
            "https://accounts.spotify.com/api/token",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                },

                body: new URLSearchParams({
                    client_id: CLIENT_ID,
                    grant_type: "authorization_code",
                    code: code,
                    redirect_uri: REDIRECT_URI,
                    code_verifier: verifier
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("Token error:", data);

            showError(
                "Spotify login failed."
            );

            return;
        }

        accessToken = data.access_token;

        const expiresAt =
            Date.now() +
            (data.expires_in * 1000);

        sessionStorage.setItem(
            "spotify_access_token",
            accessToken
        );

        sessionStorage.setItem(
            "spotify_token_expires",
            expiresAt.toString()
        );

        window.history.replaceState(
            {},
            document.title,
            REDIRECT_URI
        );

        console.log(
            "Spotify login successful."
        );

        onLoggedIn();

    } catch (error) {

        console.error(
            "Token exchange failed:",
            error
        );

        showError(
            "Could not connect to Spotify."
        );
    }
}


// ============================================================
// CHECK LOGIN
// ============================================================

function checkForAuthCode() {

    const params = new URLSearchParams(
        window.location.search
    );

    const code = params.get("code");

    if (code) {
        exchangeCodeForToken(code);
        return;
    }

    const savedToken =
        sessionStorage.getItem(
            "spotify_access_token"
        );

    const expires =
        Number(
            sessionStorage.getItem(
                "spotify_token_expires"
            )
        );

    if (
        savedToken &&
        expires &&
        Date.now() < expires
    ) {
        accessToken = savedToken;

        onLoggedIn();

    } else {

        clearSpotifyLogin();
    }
}


// ============================================================
// CLEAR LOGIN
// ============================================================

function clearSpotifyLogin() {

    accessToken = null;

    sessionStorage.removeItem(
        "spotify_access_token"
    );

    sessionStorage.removeItem(
        "spotify_token_expires"
    );

    sessionStorage.removeItem(
        "spotify_code_verifier"
    );
}


// ============================================================
// AFTER LOGIN
// ============================================================

function onLoggedIn() {

    if (loginButton) {
        loginButton.style.display = "none";
    }

    if (songTitle) {
        songTitle.textContent =
            "Connecting to Spotify...";
    }

    if (artistName) {
        artistName.textContent =
            "Please wait";
    }

    if (albumName) {
        albumName.textContent =
            "Bollywood Safar";
    }

    loadSpotifySDK();
}


// ============================================================
// LOAD SPOTIFY SDK
// ============================================================

function loadSpotifySDK() {

    if (window.Spotify) {
        initializePlayer();
        return;
    }

    window.onSpotifyWebPlaybackSDKReady =
        initializePlayer;
}


// ============================================================
// INITIALIZE PLAYER
// ============================================================

function initializePlayer() {

    if (spotifyPlayer) {
        return;
    }

    if (!window.Spotify) {
        console.error(
            "Spotify Web Playback SDK not loaded."
        );

        showError(
            "Spotify SDK failed to load."
        );

        return;
    }

    console.log(
        "Initializing Spotify Player..."
    );

    spotifyPlayer = new Spotify.Player({

        name:
            "Bollywood Safar Web Player",

        getOAuthToken:
            callback => {
                callback(accessToken);
            },

        volume:
            0.8
    });


    // PLAYER READY

    spotifyPlayer.addListener(
        "ready",
        ({ device_id }) => {

            console.log(
                "Spotify Player Ready:",
                device_id
            );

            deviceId = device_id;

            playerReady = true;

            loadSong(
                currentSongIndex
            );

            console.log(
                "Songs available:",
                songs.length
            );
        }
    );


    // PLAYER NOT READY

    spotifyPlayer.addListener(
        "not_ready",
        ({ device_id }) => {

            console.warn(
                "Spotify Player Offline:",
                device_id
            );

            playerReady = false;
        }
    );


    // INITIALIZATION ERROR

    spotifyPlayer.addListener(
        "initialization_error",
        ({ message }) => {

            console.error(
                "Initialization error:",
                message
            );

            showError(
                "Spotify player could not start."
            );
        }
    );


    // AUTHENTICATION ERROR

    spotifyPlayer.addListener(
        "authentication_error",
        ({ message }) => {

            console.error(
                "Authentication error:",
                message
            );

            clearSpotifyLogin();

            if (loginButton) {
                loginButton.style.display =
                    "inline-block";
            }

            showError(
                "Spotify session expired. Login again."
            );
        }
    );


    // ACCOUNT ERROR

    spotifyPlayer.addListener(
        "account_error",
        ({ message }) => {

            console.error(
                "Account error:",
                message
            );

            showError(
                "Spotify Premium is required."
            );

            if (artistName) {
                artistName.textContent =
                    "Please login with Spotify Premium";
            }
        }
    );


    // PLAYBACK ERROR

    spotifyPlayer.addListener(
        "playback_error",
        ({ message }) => {

            console.error(
                "Playback error:",
                message
            );
        }
    );


    // PLAYER STATE

    spotifyPlayer.addListener(
        "player_state_changed",
        async state => {

            if (!state) {
                return;
            }

            isPlaying = !state.paused;

            if (playButton) {
                playButton.textContent =
                    isPlaying ? "❚❚" : "▶";
            }


            // UPDATE SONG INFORMATION

            if (
                state.track_window &&
                state.track_window.current_track
            ) {

                const currentTrack =
                    state.track_window.current_track;

                if (
                    currentTrack.name &&
                    songTitle
                ) {
                    songTitle.textContent =
                        currentTrack.name;
                }

                if (
                    currentTrack.artists &&
                    currentTrack.artists.length > 0 &&
                    artistName
                ) {
                    artistName.textContent =
                        currentTrack.artists
                            .map(
                                artist => artist.name
                            )
                            .join(", ");
                }

                if (
                    currentTrack.album &&
                    currentTrack.album.name &&
                    albumName
                ) {
                    albumName.textContent =
                        currentTrack.album.name;
                }
            }


            // UPDATE PROGRESS

            if (
                state.duration &&
                state.duration > 0
            ) {

                const percentage =
                    (state.position /
                        state.duration) * 100;

                if (progressBar) {
                    progressBar.value =
                        percentage;
                }

                if (currentTimeEl) {
                    currentTimeEl.textContent =
                        formatTime(
                            state.position / 1000
                        );
                }

                if (durationEl) {
                    durationEl.textContent =
                        formatTime(
                            state.duration / 1000
                        );
                }


                // AUTOMATIC NEXT SONG

                const remainingTime =
                    state.duration -
                    state.position;

                if (
                    isPlaying &&
                    remainingTime <= 800 &&
                    !autoNextTriggered &&
                    !isLoadingSong
                ) {

                    autoNextTriggered = true;

                    console.log(
                        "Song finished. Playing next song..."
                    );

                    setTimeout(
                        async () => {

                            if (
                                songs &&
                                songs.length > 0
                            ) {

                                currentSongIndex =
                                    (
                                        currentSongIndex + 1
                                    ) %
                                    songs.length;

                                loadSong(
                                    currentSongIndex
                                );

                                await playCurrentSong();
                            }
                        },
                        500
                    );
                }


                // RESET AUTO NEXT

                if (
                    state.position < 3000 &&
                    remainingTime > 3000
                ) {
                    autoNextTriggered = false;
                }
            }
        }
    );


    spotifyPlayer.connect();
}


// ============================================================
// LOAD SONG INFORMATION
// ============================================================

function loadSong(index) {

    if (
        !songs ||
        !songs[index]
    ) {
        return;
    }

    const song = songs[index];

    if (songTitle) {
        songTitle.textContent =
            song.title;
    }

    if (artistName) {
        artistName.textContent =
            song.artist;
    }

    if (albumName) {
        albumName.textContent =
            song.album ||
            "Bollywood Safar";
    }

    if (progressBar) {
        progressBar.value = 0;
    }

    if (currentTimeEl) {
        currentTimeEl.textContent =
            "0:00";
    }

    if (durationEl) {
        durationEl.textContent =
            "0:00";
    }
}


// ============================================================
// NORMALIZE TEXT
// ============================================================

function normalize(text) {

    return String(text)
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}


// ============================================================
// CREATE CACHE KEY
// ============================================================

function getCacheKey(song) {

    return (
        "bollywood_safar_uri_" +
        normalize(song.title) +
        "_" +
        normalize(song.artist)
    );
}


// ============================================================
// SEARCH SONG ON SPOTIFY
// ============================================================

async function searchTrack(song) {

    const cacheKey =
        getCacheKey(song);

    const cachedUri =
        localStorage.getItem(
            cacheKey
        );


    // USE CACHED URI

    if (cachedUri) {

        console.log(
            "Using cached song:",
            song.title
        );

        return cachedUri;
    }


    const queries = [

        `track:${song.title} artist:${song.artist}`,

        `${song.title} ${song.artist}`,

        `track:${song.title}`
    ];


    for (const query of queries) {

        try {

            console.log(
                "Searching:",
                query
            );

            const response = await fetch(

                "https://api.spotify.com/v1/search?" +

                new URLSearchParams({
                    q: query,
                    type: "track",
                    limit: "10",
                    market: "IN"
                }),

                {
                    headers: {
                        Authorization:
                            `Bearer ${accessToken}`
                    }
                }
            );


            if (!response.ok) {

                console.warn(
                    "Search failed:",
                    response.status
                );

                if (
                    response.status === 401
                ) {

                    clearSpotifyLogin();

                    if (loginButton) {
                        loginButton.style.display =
                            "inline-block";
                    }

                    showError(
                        "Spotify session expired. Login again."
                    );

                    return null;
                }

                continue;
            }


            const data =
                await response.json();

            const tracks =
                data.tracks?.items || [];


            if (!tracks.length) {
                continue;
            }


            const targetTitle =
                normalize(song.title);

            const targetArtist =
                normalize(song.artist);


            // EXACT TITLE AND ARTIST

            let bestMatch =
                tracks.find(track => {

                    const spotifyTitle =
                        normalize(track.name);

                    const spotifyArtists =
                        track.artists
                            .map(
                                artist =>
                                    normalize(
                                        artist.name
                                    )
                            )
                            .join(" ");

                    return (
                        spotifyTitle ===
                        targetTitle
                    ) &&
                    (
                        spotifyArtists.includes(
                            targetArtist
                        )
                    );
                });


            // EXACT TITLE

            if (!bestMatch) {

                bestMatch =
                    tracks.find(
                        track =>
                            normalize(track.name) ===
                            targetTitle
                    );
            }


            // PARTIAL TITLE MATCH

            if (!bestMatch) {

                bestMatch =
                    tracks.find(track => {

                        const spotifyTitle =
                            normalize(track.name);

                        return (
                            spotifyTitle.includes(
                                targetTitle
                            ) ||
                            targetTitle.includes(
                                spotifyTitle
                            )
                        );
                    });
            }


            // FIRST RESULT

            if (!bestMatch) {
                bestMatch = tracks[0];
            }


            if (bestMatch?.uri) {

                console.log(
                    "Found:",
                    song.title,
                    "→",
                    bestMatch.name
                );

                localStorage.setItem(
                    cacheKey,
                    bestMatch.uri
                );

                return bestMatch.uri;
            }

        } catch (error) {

            console.error(
                "Search error:",
                error
            );
        }
    }

    return null;
}


// ============================================================
// PLAY CURRENT SONG
// ============================================================

async function playCurrentSong() {

    if (isLoadingSong) {
        return;
    }


    if (
        !playerReady ||
        !deviceId
    ) {

        showError(
            "Spotify player is still connecting..."
        );

        return;
    }


    const song =
        songs[currentSongIndex];


    if (!song) {
        return;
    }


    isLoadingSong = true;


    if (songTitle) {
        songTitle.textContent =
            `Finding ${song.title}...`;
    }

    if (artistName) {
        artistName.textContent =
            song.artist;
    }


    try {

        let uri = song.uri;


        // SEARCH ONLY IF URI IS MISSING

        if (!uri) {

            uri =
                await searchTrack(song);

            song.uri = uri;
        }


        if (!uri) {

            showError(
                `${song.title} was not found on Spotify.`
            );

            return;
        }


        autoNextTriggered = false;


        // ACTIVATE PLAYER

        await spotifyPlayer.activateElement();


        const response = await fetch(

            `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,

            {
                method: "PUT",

                headers: {

                    Authorization:
                        `Bearer ${accessToken}`,

                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({
                        uris: [uri]
                    })
            }
        );


        if (!response.ok) {

            const errorText =
                await response.text();

            console.error(
                "Playback API error:",
                errorText
            );

            showError(
                "Spotify could not start this song."
            );

            return;
        }


        console.log(
            "Playing:",
            song.title
        );


        loadSong(
            currentSongIndex
        );

    } catch (error) {

        console.error(
            "Playback failed:",
            error
        );

        showError(
            "Playback request failed."
        );

    } finally {

        isLoadingSong = false;
    }
}


// ============================================================
// PLAY / PAUSE
// ============================================================

if (playButton) {

    playButton.addEventListener(
        "click",
        async () => {

            if (!spotifyPlayer) {

                showError(
                    "Connect to Spotify first."
                );

                return;
            }


            if (isPlaying) {

                await spotifyPlayer.pause();

                return;
            }


            try {

                const state =
                    await spotifyPlayer.getCurrentState();


                if (
                    state &&
                    state.paused &&
                    state.position > 0
                ) {

                    await spotifyPlayer.resume();

                } else {

                    await playCurrentSong();
                }

            } catch (error) {

                console.error(
                    "Play button error:",
                    error
                );

                await playCurrentSong();
            }
        }
    );
}


// ============================================================
// NEXT SONG
// ============================================================

if (nextButton) {

    nextButton.addEventListener(
        "click",
        async () => {

            if (
                !songs ||
                songs.length === 0
            ) {
                return;
            }


            currentSongIndex =
                (
                    currentSongIndex + 1
                ) %
                songs.length;


            autoNextTriggered = false;


            loadSong(
                currentSongIndex
            );


            await playCurrentSong();
        }
    );
}


// ============================================================
// PREVIOUS SONG
// ============================================================

if (previousButton) {

    previousButton.addEventListener(
        "click",
        async () => {

            if (
                !songs ||
                songs.length === 0
            ) {
                return;
            }


            currentSongIndex =
                (
                    currentSongIndex -
                    1 +
                    songs.length
                ) %
                songs.length;


            autoNextTriggered = false;


            loadSong(
                currentSongIndex
            );


            await playCurrentSong();
        }
    );
}


// ============================================================
// SHUFFLE SONG
// ============================================================

if (shuffleButton) {

    shuffleButton.addEventListener(
        "click",
        async () => {

            if (
                !songs ||
                songs.length < 2
            ) {
                return;
            }


            let newIndex;


            do {

                newIndex =
                    Math.floor(
                        Math.random() *
                        songs.length
                    );

            } while (
                newIndex ===
                currentSongIndex
            );


            currentSongIndex =
                newIndex;


            autoNextTriggered = false;


            loadSong(
                currentSongIndex
            );


            await playCurrentSong();
        }
    );
}


// ============================================================
// SEEK SONG
// ============================================================

if (progressBar) {

    progressBar.addEventListener(
        "input",
        async () => {

            if (!spotifyPlayer) {
                return;
            }


            try {

                const state =
                    await spotifyPlayer.getCurrentState();


                if (
                    !state ||
                    !state.duration
                ) {
                    return;
                }


                const seekPosition =
                    (
                        Number(
                            progressBar.value
                        ) / 100
                    ) *
                    state.duration;


                await spotifyPlayer.seek(
                    seekPosition
                );


                if (
                    seekPosition <
                    state.duration - 2000
                ) {

                    autoNextTriggered =
                        false;
                }

            } catch (error) {

                console.error(
                    "Seek error:",
                    error
                );
            }
        }
    );
}


// ============================================================
// FORMAT TIME
// ============================================================

function formatTime(seconds) {

    if (
        !Number.isFinite(seconds)
    ) {
        return "0:00";
    }


    const minutes =
        Math.floor(seconds / 60);


    const remainingSeconds =
        Math.floor(seconds % 60);


    return (
        minutes +
        ":" +
        String(
            remainingSeconds
        ).padStart(
            2,
            "0"
        )
    );
}


// ============================================================
// SHOW ERROR
// ============================================================

function showError(message) {

    console.error(message);

    if (songTitle) {
        songTitle.textContent =
            message;
    }
}


// ============================================================
// LOGIN BUTTON
// ============================================================

if (loginButton) {

    loginButton.addEventListener(
        "click",
        loginWithSpotify
    );
}


// ============================================================
// START APPLICATION
// ============================================================

console.log(
    "================================"
);

console.log(
    "BOLLYWOOD SAFAR"
);

console.log(
    "Spotify Web Playback SDK"
);

console.log(
    "Redirect URI:",
    REDIRECT_URI
);

console.log(
    "Total Songs:",
    typeof songs !== "undefined"
        ? songs.length
        : 0
);

console.log(
    "================================"
);


// ============================================================
// START
// ============================================================

checkForAuthCode();
