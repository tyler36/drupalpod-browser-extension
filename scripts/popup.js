document.addEventListener('DOMContentLoaded', function() {
    getDrupalPodRepo();

    // Check current URL to activate extension only on relevant pages
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
        let url = tabs[0].url;
        // use `url` here inside the callback because it's asynchronous!
        checkURL(url);
    });

    function checkURL(url) {
        // Run only on Drupal issues pages, otherwise display a message
        // const projectPageRegex = /(https:\/\/www.drupal.org\/project\/)\w+\/?$/gm;
        const projectIssuePageRegex = /(https:\/\/www.drupal.org\/project\/)\w+(\/issues\/)\d+\/?$/gm;

        if (projectIssuePageRegex.exec(url) !== null) {
            readIssueContent();
        }
        else {
            displayWarning('not-issue-page-instructions');
            // Hide 'please wait' message
            const pageStatusElement = document.querySelector('.reading-page-status');
            pageStatusElement.classList.add('hidden');
        }
    }

    function readIssueContent() {
        chrome.tabs.executeScript({
        code: `(${ inContent })(${ JSON.stringify({ foo: 'bar' }) })`
        }, ([result] = []) => {
            // Hide 'please wait' message
            const pageStatusElement = document.querySelector('.reading-page-status');
            pageStatusElement.classList.add('hidden');
            if (!chrome.runtime.lastError) {
                populateIssueFork(result);
            } else {
                console.error(chrome.runtime.lastError);
                displayWarning('something-went-wrong-instructions');
            }
        });

        function inContent(params) {

            const pathArray = window.location.pathname.split('/');

            const issueFork = document.querySelector('.fork-link') ? document.querySelector('.fork-link').innerText : false;
            const allBranches = document.querySelector('.branches') ? document.querySelector('.branches').children : false;

            // Get links to find patches
            const allLinks = document.querySelector('a');
            const issueBranches = [];
            Array.from(allBranches).forEach((element) => {
                issueBranches.push(element.dataset.branch);
            });

            const loggedIn = document.querySelector('.person') ? true : false;
            const pushAccess = document.querySelector('.push-access') ? true : false;

            return {
                success: true,
                pathArray: pathArray,
                issueFork: issueFork,
                allLinks: allLinks,
                issueBranches: issueBranches,
                loggedIn: loggedIn,
                pushAccess: pushAccess,
            };
        }
    }

    function populateIssueFork(pageResults) {
        if (!pageResults.loggedIn) {
            displayWarning('not-logged-in-instructions');
            return;
        }

        // Check if issue fork found in the page
        if (pageResults.issueFork) {
            if (!pageResults.pushAccess) {
                displayWarning('no-push-access-instructions');
                return;
            }

            const projectName = pageResults.pathArray[2];
            const projectNameStatus = document.getElementById('project-name');
            projectNameStatus.innerHTML = projectName;

            getProjectType(projectName).then((projectType) => {
                const projectTypeStatus = document.getElementById('project-type');
                projectTypeStatus.innerHTML = projectType;
            });

            const issueForkStatus = document.getElementById('issue-fork');
            issueForkStatus.innerHTML = pageResults.issueFork;

            const drupalCoreVersionsArray = ['9.2.0', '8.9.x', '9.0.x', '9.1.x', '9.2.x', '9.3.x'];
            const drupalInstallProfiles = ['(none)', 'standard', 'demo_umami', 'minimal'];
            const availablePatchesArray = getPatchesFromLinks(pageResults.allLinks);

            populateSelectList('issue-branch', pageResults.issueBranches);
            populateSelectList('core-version', drupalCoreVersionsArray);
            populateSelectList('install-profile', drupalInstallProfiles);
            populateSelectList('available-patches', availablePatchesArray);

            // Display form
            const formSelectionElement = document.querySelector('.form-selection');
            formSelectionElement.classList.remove('hidden');
        } else {
            displayWarning('no-issue-fork-instructions');
        }
    }

    // activate button
    var button = document.getElementById('submit');
    button.addEventListener('click', () => {
        openDevEnv();
    });

    function openNewTab(baseUrl, projectName, issueFork, issueBranch, projectType, coreVersion, installProfile, envRepo) {

    }

    function openDevEnv() {
        // Build URL structure to open Gitpod

        const baseUrl = 'https://gitpod.io/#';
        const envRepo = document.getElementById('devdrupalpod').innerText;
        const projectName = 'DP_PROJECT_NAME=' + document.getElementById('project-name').innerText;
        const issueFork = 'DP_ISSUE_FORK=' + document.getElementById('issue-fork').innerText;
        const issueBranch = 'DP_ISSUE_BRANCH=' + getSelectValue('issue-branch');
        const projectType = 'DP_PROJECT_TYPE=' + document.getElementById('project-type').innerText;
        const coreVersion = 'DP_CORE_VERSION=' + getSelectValue('core-version');
        const installProfile = 'DP_INSTALL_PROFILE=' + (getSelectValue('install-profile') === '(none)' ? "\'\'" : getSelectValue('install-profile'));

        chrome.tabs.create({
            url: baseUrl +
            projectName +
            ',' +
            issueFork +
            ',' +
            issueBranch +
            ',' +
            projectType +
            ',' +
            coreVersion +
            ',' +
            installProfile +
            '/' +
            envRepo
        })
        window.close();
    }

});

function getSelectValue(id) {
    var selectElement = document.getElementById(id);
    return selectElement.options[ selectElement.selectedIndex ].value;
}

function getPatchesFromLinks(linksArray) {
    const regex = /^https:\/\/www\.drupal\.org\/files\/issues\/.*\.patch$/;
    // linksArray.map
    const str = `https://www.drupal.org/files/issues/2021-04-22/scheduler-stop-unpublishing-on-scheduled-publish-3210321-1.patch`;
    let m;

    // const numbers = [1, 2, 3, 4];
    // const evens = numbers.filter(item => item % 2 === 0);
    const patchesFound = linksArray.filter(item => {
        return regex.exec(str);
    });

    console.log('patchesFound', patchesFound);
}

function displayWarning(className) {
    // Reveal error message
    const warningMessageElement = document.querySelector('.' + className);
    warningMessageElement.classList.remove('hidden');
}

function populateSelectList(id, options) {
    const select = document.getElementById(id);

    options.forEach(element => {
        const opt = document.createElement('option');
        opt.value = element;
        opt.innerHTML = element;
        select.appendChild(opt);
    });
}

async function getProjectType(projectName) {
    const url = 'https://www.drupal.org/api-d7/node.json?field_project_machine_name=' + projectName;
    let obj = null;

    try {
        obj = await (await fetch(url)).json();
        return await(obj.list[0].type);
    } catch(e) {
        console.error(e);
    }
}

function getDrupalPodRepo() {
    chrome.runtime.sendMessage({message: 'fetch-drupalpod-repo'}, (response) => {
        // return response.message;
        const drupalPotRepoStatus = document.getElementById('devdrupalpod');
        drupalPotRepoStatus.innerText = response.message;
    });
}
