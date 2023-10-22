import { callPopup } from "../../../../script.js";

const gameStore = new localforage.createInstance({ name: "SillyTavern_EmulatorJS" });
const baseUrl = '/scripts/extensions/third-party/SillyTavern-EmulatorJS/plugin.html';

const cores = {
    "Nintendo 64": "n64",
    "Nintendo Game Boy": "gb",
    "Nintendo Game Boy Advance": "gba",
    "Nintendo DS": "nds",
    "Nintendo Entertainment System": "nes",
    "Super Nintendo Entertainment System": "snes",
    "PlayStation": "psx",
    "Virtual Boy": "vb",
    "Sega Mega Drive": "segaMD",
    "Sega Master System": "segaMS",
    "Sega CD": "segaCD",
    "Atari Lynx": "lynx",
    "Sega 32X": "sega32x",
    "Atari Jaguar": "jaguar",
    "Sega Game Gear": "segaGG",
    "Sega Saturn": "segaSaturn",
    "Atari 7800": "atari7800",
    "Atari 2600": "atari2600",
    "NEC TurboGrafx-16/SuperGrafx/PC Engine": "pce",
    "NEC PC-FX": "pcfx",
    "SNK NeoGeo Pocket (Color)": "ngp",
    "Bandai WonderSwan (Color)": "ws",
    "ColecoVision": "coleco",
    "Commodore 64": "vice_x64"
}

function tryGetCore(ext) {
    if (["fds", "nes", "unif", "unf"].includes(ext))
        return "nes"

    if (["smc", "fig", "sfc", "gd3", "gd7", "dx2", "bsx", "swc"].includes(ext))
        return "snes"

    if (["gen", "bin", "smd", "md"].includes(ext))
        return "segaMD"

    if (["sms"].includes(ext))
        return "segaMS"

    if (["vb"].includes(ext))
        return "vb"

    if (["lynx"].includes(ext))
        return "lynx"

    if (["32x"].includes(ext))
        return "sega32x"

    if (["j64", "jag"].includes(ext))
        return "jaguar"

    if (["gg"].includes(ext))
        return "segaGG"

    if (["z64", "n64"].includes(ext))
        return "n64"

    if (["pce"].includes(ext))
        return "pce"

    if (["ngp", "ngc"].includes(ext))
        return "ngp"

    if (["ws", "wsc"].includes(ext))
        return "ws"

    if (["col", "cv"].includes(ext))
        return "coleco"

    if (["d64"].includes(ext))
        return "vice_x64"

    if (["iso", "bin", "chd", "cue", "ccd", "mds", "mdf", "pbp", "cbn", "nrg", "cdi", "gdi", "cue", "cd"].includes(ext))
        return "psx"

    if (["nds", "gba", "gb", "z64", "n64"].includes(ext))
        return ext
}


function drawGameList() {
    const gameList = $('#game_list');
    gameList.empty();

    gameStore.iterate((value, key) => {
        const id = DOMPurify.sanitize(key);
        const name = DOMPurify.sanitize(value.name);
        const core = DOMPurify.sanitize(value.core);
        const div = $(`
            <div class="flex-container alignitemscenter">
                <div title="Launch the game" class="emulatorjs_play fa-solid fa-play menu_button" id="${id}"></div>
                <span class="emulatorjs_rom_name flex1" title="${name}">${name}</span>
                <small>${core}</small>
            </div>
        `);
        gameList.append(div);
    });
}

function onGameFileSelect() {
    const file = this.files[0];
    const parts = file.name.split('.');
    const ext = parts.pop();
    let name = parts.join('.');
    let core = tryGetCore(ext) || 'nes';

    const popupText = `
        <div>
            <h4>Core</h4>
            <select id="emulatorjs_cores" class="text_pole wide100p"></select>
            <h4>Name</h4>
            <textarea id="emulatorjs_name" type="text" class="text_pole wide100p" placeholder="<Name>" rows="2"></textarea>
        </div>`;

    const popupInstance = $(popupText);
    const coreSelect = popupInstance.find('#emulatorjs_cores');
    coreSelect.on('input change', () => {
        core = coreSelect.val();
    });
    const nameInput = popupInstance.find('#emulatorjs_name');

    nameInput.on('input change', () => {
        name = nameInput.val();
    });

    for (const [key, value] of Object.entries(cores)) {
        const option = document.createElement('option');
        option.innerText = key;
        option.value = value;
        option.selected = value === core;
        coreSelect.append(option);
    }

    nameInput.val(name).trigger('input');
    coreSelect.val(core).trigger('change');

    const reader = new FileReader();
    reader.onload = async (event) => {
        await callPopup(popupInstance, 'text');
        const data = event.target.result;
        const slug = `emulatorjs-${Math.random().toString(36).substring(2, 15)}`;

        const game = {
            name: name,
            core: core,
            data: data,
        };

        await gameStore.setItem(slug, game);
        drawGameList();
    }

    reader.readAsDataURL(file);
}

async function startEmulator(gameId) {
    let game = {};

    if (gameId) {
        game = await gameStore.getItem(gameId);
    } else {
        const popupText = `<div><h3>Select a ROM file:</h3><select id="emulatorjs_game_select" class="wide100p text_pole"></select></div>`;
        const popupInstance = $(popupText);

        const gameSelect = popupInstance.find('#emulatorjs_game_select').on('input change', async () => {
            game = await gameStore.getItem(gameSelect.val());
        });

        await gameStore.iterate((value, key) => {
            const option = document.createElement('option');
            option.innerText = `${value.name} - ${value.core}`;
            option.value = key;
            gameSelect.append(option);
        });

        if (gameSelect.children().length === 0) {
            toastr.info('No games found. Please add a game first.');
            return;
        }

        gameSelect.trigger('change');
        await callPopup(popupInstance, 'text');
    }

    if (!game?.data) {
        toastr.error('Failed to start EmulatorJS. Please try again.');
        return;
    }

    const slug = 'emulatorjs-frame-' + Math.random().toString(36).substring(2, 15);
    const context = window['SillyTavern'].getContext();
    context.sendSystemMessage('generic', slug);

    if (Array.isArray(context.chat)) {
        for (const message of context.chat) {
            if (message.mes == slug) {
                const coreName = Object.keys(cores).find(key => cores[key] === game.core);
                message.mes = `[EmulatorJS: ${context.name1} launches the game ${game.name} on ${coreName}]`;
                break;
            }
        }
    }

    const slugMessage = $('#chat .last_mes .mes_text');
    if (slugMessage.text().includes(slug)) {
        const frame = `<iframe id="${slug}" class="emulatorjs_game" src="${baseUrl}"></iframe>`;
        const frameInstance = $(frame);
        slugMessage.empty().append(frameInstance);

        frameInstance.on('load', () => {
            const frameElement = frameInstance[0];
            if (frameElement instanceof HTMLIFrameElement) {
                frameElement.contentWindow.postMessage(game, '*');
                frameElement.contentWindow.addEventListener('click', () => {
                    frameElement.contentWindow.focus();
                });
                frameElement.contentWindow.addEventListener('mousemove', () => {
                    frameElement.contentWindow.focus();
                });
            }
        });

        $('#chat').scrollTop($('#chat')[0].scrollHeight);
    } else {
        toastr.error('Failed to start EmulatorJS. Please try again.');
        return;
    }
}

jQuery(() => {
    const button = $(`
    <div id="emulatorjs_start" class="list-group-item flex-container flexGap5">
        <div class="fa-solid fa-gamepad" title="Start a new game in the emulator"/></div>
        Play EmulatorJS
    </div>`);

    $('#extensionsMenu').append(button);

    const settings = `
    <div class="emulatorjs_settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>EmulatorJS</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <input id="emulatorjs_file" type="file" hidden />
                <div class="flex-container wide100p alignitemscenter">
                    <h3 class="flex1">ROM Files</h3>
                    <div id="emulatorjs_add" class="menu_button menu_button_icon">Add ROM file</div>
                </div>
                <hr>
                <div id="game_list"></div>
            </div>
        </div>
    </div>`;

    $('#extensions_settings2').append(settings);
    $('#emulatorjs_add').on('click', function () {
        $('#emulatorjs_file').trigger('click');
    });
    $('#emulatorjs_file').on('change', onGameFileSelect);
    $('#emulatorjs_start').on('click', function () {
        startEmulator();
    });
    $(document).on('click', '.emulatorjs_play', function () {
        const id = $(this).attr('id');
        startEmulator(id);
        $('#chat').trigger('click');
    });

    drawGameList();
});
