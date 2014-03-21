//
// Copyright (C) 2013 Participatory Culture Foundation
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see
// http://www.gnu.org/licenses/agpl-3.0.html.

var angular = angular || null;

(function() {

    var module = angular.module('amara.SubtitleEditor', [
        'amara.SubtitleEditor.blob',
        'amara.SubtitleEditor.collab',
        'amara.SubtitleEditor.help',
        'amara.SubtitleEditor.modal',
        'amara.SubtitleEditor.dom',
        'amara.SubtitleEditor.lock',
        'amara.SubtitleEditor.workflow',
        'amara.SubtitleEditor.subtitles.controllers',
        'amara.SubtitleEditor.subtitles.directives',
        'amara.SubtitleEditor.subtitles.filters',
        'amara.SubtitleEditor.subtitles.models',
        'amara.SubtitleEditor.subtitles.services',
        'amara.SubtitleEditor.timeline.controllers',
        'amara.SubtitleEditor.timeline.directives',
        'amara.SubtitleEditor.video.controllers',
        'amara.SubtitleEditor.video.directives',
        'amara.SubtitleEditor.video.services',
        'ngCookies'
    ]);

    module.config(function($compileProvider, $interpolateProvider) {
        // instead of using {{ }} for variables, use [[ ]]
        // so as to avoid conflict with django templating
        $interpolateProvider.startSymbol('[[');
        $interpolateProvider.endSymbol(']]');
        // Allow blob: urls
        $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|blob):/);
    });

    module.constant('MIN_DURATION', 250); // 0.25 seconds
    module.constant('DEFAULT_DURATION', 4000); // 4 seconds

    module.controller("AppController", ['$scope', '$sce', '$controller', 
                      '$window', 'DialogManager', 'EditorData', 'VideoPlayer',
                      'Workflow', function($scope, $sce, $controller,
            $window, DialogManager, EditorData, VideoPlayer, Workflow) {
        $controller('AppControllerSubtitles', {$scope: $scope});
        $controller('AppControllerLocking', {$scope: $scope});
        $controller('AppControllerEvents', {$scope: $scope});

        $scope.videoId = EditorData.video.id;
        $scope.canSync = EditorData.canSync;
        $scope.canAddAndRemove = EditorData.canAddAndRemove;
        $scope.scrollingSynced = true;
        $scope.loadingFinished = false;
	$scope.currentTitle = {};
	$scope.currentTitle.Edited = false;
	$scope.dialogManager = new DialogManager(VideoPlayer);
	$scope.titleEdited = function(newValue) {
	    if (newValue != undefined) $scope.currentTitle.Edited = newValue;
	    return $scope.currentTitle.Edited;
	}
        $scope.translating = function() {
            return ($scope.workingSubtitles.language.code !=  $scope.referenceSubtitles.language.code);
        }
        if (EditorData.teamAttributes) {
            $scope.teamName = EditorData.teamAttributes.teamName
            if (EditorData.teamAttributes.guidelines &&
		(EditorData.teamAttributes.guidelines['subtitle'] ||
		 EditorData.teamAttributes.guidelines['translate'] ||
		 EditorData.teamAttributes.guidelines['review'])
	       ) {
		var noGuideline = "No guidelines specified.";
                $scope.teamGuidelines = { 'subtitle': $sce.trustAsHtml(EditorData.teamAttributes.guidelines['subtitle'] || noGuideline),
                                          'translate': $sce.trustAsHtml(EditorData.teamAttributes.guidelines['translate'] || noGuideline),
                                          'review': $sce.trustAsHtml(EditorData.teamAttributes.guidelines['review'] || noGuideline) };
            }
            // Needs to be a function as we can only know once language was retrieved
            $scope.teamTaskType = function() {
		return EditorData.task_needs_pane ? 'review' : $scope.translating() ? 'translate' : 'subtitle';
            };
        } else {
            $scope.teamTaskType = function() {return "";}
        }
        $scope.showTeamGuidelines = function() {
            if (($scope.teamGuidelines) && ($scope.teamName))
                return true;
            return false; 
        }
        $scope.workflow = new Workflow($scope.workingSubtitles.subtitleList, $scope.translating, $scope.titleEdited);
        $scope.timelineShown = ($scope.workflow.stage != 'type' ||
                EditorData.task_needs_pane);
        $scope.toggleScrollingSynced = function() {
            $scope.scrollingSynced = !$scope.scrollingSynced;
        }
        $scope.toggleTimelineShown = function() {
            $scope.timelineShown = !$scope.timelineShown
        }
        $scope.keepHeaderSizeSync = function() {
            var newHeaderSize = Math.max($('div.subtitles.reference .content').outerHeight(),
                                         $('div.subtitles.working .content').outerHeight());
            $('div.subtitles.reference .content').css('min-height', '' + newHeaderSize + 'px');
            $('div.subtitles.working .content').css('min-height', '' + newHeaderSize + 'px');
        };
        // TODO: what is the angularjs way to bind functions to DOM events?
        $( "div.subtitles .content" ).change($scope.keepHeaderSizeSync);
        $scope.adjustReferenceSize = function() {
            $scope.keepHeaderSizeSync();
            if($scope.referenceSubtitles.subtitleList.length() > 0 && ($scope.referenceSubtitles.subtitleList.length() == $scope.workingSubtitles.subtitleList.length())) {
                var $reference = $('div.subtitles.reference').first();
                var $working = $('div.subtitles.working').first();
                if($reference.height() < $working.height())
                    $reference.last().height($reference.last().height() + $working.height() - $reference.height() );
            }
        }
	/*
         * Might not be the right location
         * TODO: move this to the proper place (probably the SubtitleList
         * model).
         */
        $scope.copyTimingOver = function() {
            var nextWorkingSubtitle = $scope.workingSubtitles.subtitleList.firstSubtitle();
            var nextReferenceSubtitle = $scope.referenceSubtitles.subtitleList.firstSubtitle();
            while (nextWorkingSubtitle && nextReferenceSubtitle) {
                $scope.workingSubtitles.subtitleList.updateSubtitleTime(nextWorkingSubtitle,
                                                                        nextReferenceSubtitle.startTime,
                                                                        nextReferenceSubtitle.endTime);
                $scope.workingSubtitles.subtitleList.updateSubtitleParagraph(nextWorkingSubtitle,
                                                                             $scope.referenceSubtitles.subtitleList.getSubtitleParagraph(nextReferenceSubtitle));
                nextWorkingSubtitle = $scope.workingSubtitles.subtitleList.nextSubtitle(nextWorkingSubtitle);
                nextReferenceSubtitle = $scope.referenceSubtitles.subtitleList.nextSubtitle(nextReferenceSubtitle);
            }
            while (nextWorkingSubtitle) {
                $scope.workingSubtitles.subtitleList.updateSubtitleTime(nextWorkingSubtitle, -1, -1);
                $scope.workingSubtitles.subtitleList.updateSubtitleParagraph(nextWorkingSubtitle, false);
                nextWorkingSubtitle = $scope.workingSubtitles.subtitleList.nextSubtitle(nextWorkingSubtitle);
            }
            // Sent no matter anything has changed or not, ideally we'd only emit
            // that if anything changed
            $scope.$root.$emit('work-done');
	}
        $scope.copyTimingEnabled = function() {
            return ($scope.workingSubtitles.subtitleList.length() > 0 &&
                     $scope.referenceSubtitles.subtitleList.syncedCount > 0)
        }

        $scope.showClearTimingModal = function($event) {
            var dialogManager = $scope.dialogManager;
            dialogManager.openDialog({
                title: 'Confirm Timing Reset',
                text: 'This will remove all subtitle timing. Do you want to continue?',
                allowClose: 1,
                buttons: [
                    dialogManager.button('Continue', function() {
                        $scope.clearTiming();
                        dialogManager.close();
                    }),
                    dialogManager.button('Cancel', function() {
                        dialogManager.close();
                    })
                ]
            });
            $event.stopPropagation();
            $event.preventDefault();
        };

        $scope.clearTiming = function() {
            var nextWorkingSubtitle = $scope.workingSubtitles.subtitleList.firstSubtitle();
            while (nextWorkingSubtitle) {
                $scope.workingSubtitles.subtitleList.updateSubtitleTime(nextWorkingSubtitle, -1, -1);
                nextWorkingSubtitle = $scope.workingSubtitles.subtitleList.nextSubtitle(nextWorkingSubtitle);
             }
            $scope.$root.$emit('work-done');
        };

        $scope.showClearTextModal = function($event) {
            var dialogManager = $scope.dialogManager;
            dialogManager.openDialog({
                title: 'Confirm Text Reset',
                text: 'This will remove all subtitle text. Do you want to continue?',
                allowClose: 1,
                buttons: [
                    dialogManager.button('Continue', function() {
                        $scope.clearText();
                        dialogManager.close();
                    }),
                    dialogManager.button('Cancel', function() {
                        dialogManager.close();
                    })
                ]
            });
            $event.stopPropagation();
            $event.preventDefault();
        };

        $scope.clearText = function() {
            var nextWorkingSubtitle = $scope.workingSubtitles.subtitleList.firstSubtitle();
            while (nextWorkingSubtitle) {
                $scope.workingSubtitles.subtitleList.updateSubtitleContent(nextWorkingSubtitle, "");
                nextWorkingSubtitle = $scope.workingSubtitles.subtitleList.nextSubtitle(nextWorkingSubtitle);
             }
            $scope.$root.$emit('work-done');
        };

        $scope.showResetModal = function($event) {
            var dialogManager = $scope.dialogManager;
            dialogManager.openDialog({
                title: 'Confirm Changes Reset',
                text: 'This will revert all changes made since the last saved revision. Do you want to continue?',
                allowClose: 1,
                buttons: [
                    dialogManager.button('Continue', function() {
                        $scope.resetToLastSavedVersion();
                        dialogManager.close();
                    }),
                    dialogManager.button('Cancel', function() {
                        dialogManager.close();
                    })
                ]
            });
            $event.stopPropagation();
            $event.preventDefault();
        };

        $scope.resetToLastSavedVersion = function() {
            if($scope.workingSubtitles.versionNumber) {
                $scope.workingSubtitles.getSubtitles(EditorData.editingVersion.languageCode,
                    $scope.workingSubtitles.versionNumber);
            } else {
                $scope.workingSubtitles.initEmptySubtitles(
                    EditorData.editingVersion.languageCode, EditorData.baseLanguage);
            }
            $scope.$root.$emit('work-done');
        }

        $scope.displayedTitle = function() {
            return ($scope.workingSubtitles.getTitle() || 
                     $scope.referenceSubtitles.getTitle());
        }
        $scope.timeline = {
            shownSubtitle: null,
            currentTime: null,
            duration: null,
        };
        $scope.exitToVideoPage = function() {
            $window.location = '/videos/' + $scope.videoId + '/';
        }
        $scope.exitToLegacyEditor = function() {
            $window.location = EditorData.oldEditorURL;
        }
        $scope.showDebugModal = function(evt) {
            $scope.dialogManager.open('debug');
            evt.preventDefault();
            evt.stopPropagation();
            return false;
        };
        $scope.onGuidelinesClicked = function($event) {
            $event.preventDefault();
            $event.stopPropagation();
            $scope.dialogManager.open('guidelines');
        }
        $scope.onMoreControlsClicked = function($event) {
            $event.preventDefault();
            $event.stopPropagation();
            $scope.dialogManager.open('more-controls');
        }
        $scope.onTitleClicked = function($event) {
            $event.preventDefault();
            $event.stopPropagation();
            $scope.dialogManager.open('metadata');
        }
        // Hide the loading modal after we are done with bootstrapping
        // everything
        $scope.$evalAsync(function() {
            $scope.loadingFinished = true;
        });
        // Overrides for debugging
        $scope.overrides = {
            forceSaveError: false
        };
    }]);

    /* AppController is large, so we split it into several components to
     * keep things a bit cleaner.  Each controller runs on the same scope.
     */


    /*
     * FIXME: this can probably be moved to a service to keep the app module
     * lean and mean.
     */
    module.controller("AppControllerLocking", function($scope, $timeout, $window, EditorData, LockService) {
        var regainLockTimer;

        $scope.minutesIdle = 0;

        function releaseLock() {
            LockService.releaseLock($scope.videoId, 
                    EditorData.editingVersion.languageCode);
        }

        function regainLock() {
            return LockService.regainLock($scope.videoId,
                    EditorData.editingVersion.languageCode);
        }

        function userIdleTimeout() {
            $scope.minutesIdle++;

            if ($scope.minutesIdle >= USER_IDLE_MINUTES) {
                $scope.showIdleModal();
                $timeout.cancel(regainLockTimer);
            } else {
                startUserIdleTimer();
            }
        }

        function startUserIdleTimer() {
            $timeout(userIdleTimeout, 60 * 1000);
        }

        $scope.cancelUserIdleTimeout = function() {
            $timeout.cancel(userIdleTimeout);
        }

        function startRegainLockTimer() {
            var regainLockTimeout = function() {
                regainLock();
                regainLockTimer = $timeout(regainLockTimeout, 15 * 1000);
            };

            regainLockTimer = $timeout(regainLockTimeout, 15 * 1000);

        }

        function regainLockAfterIdle() {
            regainLock().then(function onSuccess(response) {
                if (response.data.ok) {
                    $scope.dialogManager.close();
                    $scope.minutesIdle = 0;
                    startRegainLockTimer();
                    startUserIdleTimer();
                } else {
                    $scope.showResumeSessionErrorModal();
                }
            }, function onError() {
                $scope.showResumeSessionErrorModal();
            });
        }
        $scope.showIdleModal = function () {
            var secondsUntilClosing = 120;
            
            function makeText() {
                return "You've been idle for more than " + USER_IDLE_MINUTES + " minutes. " + "To ensure no work is lost we will close your session in " + secondsUntilClosing + " seconds.";
            }

            function closeSessionTick() {
                if (--secondsUntilClosing <= 0) {
                    $scope.dialogManager.close();
                    $scope.showCloseSessionModal();
                } else {
                    $scope.dialogManager.generic.text = makeText();
                    closeSessionTimeout = $timeout(closeSessionTick, 1000);
                }
            }

            var closeSessionTimeout = $timeout(closeSessionTick, 1000);

            $scope.dialogManager.openDialog({
                title: 'Warning: Your session will close',
                text: makeText(),
                buttons: [
                    $scope.dialogManager.button('Try to resume work',
                        function() {
                            if (closeSessionTimeout) {
                                $timeout.cancel(closeSessionTimeout);
                            }
                            regainLockAfterIdle();
                    }),
                    $scope.dialogManager.button('Close Editor', function() {
                        $scope.exitToVideoPage();
                    })
                ]
            });
        }

        $scope.showCloseSessionModal = function() {
            releaseLock();
            var dialogManager = $scope.dialogManager;

            dialogManager.openDialog({
                title: 'Your session has ended. You can try to resume, or close the editor.',
                buttons: [
                    dialogManager.button('Try to resume work', function() {
                        regainLockAfterIdle();
                    }),
                    dialogManager.button('Close editor', function() {
                        dialogManager.close();
                        $scope.exitToVideoPage();
                    })
                ]
            });
        }

        $scope.showResumeSessionErrorModal = function() {
            $scope.dialogManager.open('resume-error');
        }

        startUserIdleTimer();
        startRegainLockTimer();

        $window.onunload = function() {
            releaseLock();
        }
    });

    module.controller("AppControllerEvents", function($scope, VideoPlayer) {
        function insertAndEditSubtitle() {
            var sub = $scope.workingSubtitles.subtitleList.insertSubtitleBefore(null);
            $scope.currentEdit.start(sub);
        }

        // This function is to have the keyboard shortcut help
        // panel trigger same actions as keystrokes
        $scope.handleMouseKeyDown = function(keyString) {
            var evt = {
                ctrlKey: false,
                shiftKey: false,
                preventDefault: function() {},
                stopPropagation: function() {},
                target: {}
            }
            var keys = keyString.split('-');
            evt.keyCode = parseInt(keys[0]);
            for (var i = 1 ; i < keys.length ; i++) {
                if (keys[i] == "ctrl")
                    evt.ctrlKey = true;
                else if (keys[i] == "shift")
                    evt.shiftKey = true;
            }
            $scope.handleAppKeyDown(evt);
        }

        $scope.handleAppKeyDown = function(evt) {
            // Reset the lock timer.
            $scope.minutesIdle = 0;

            if (evt.keyCode == 9 && !evt.shiftKey) {
                VideoPlayer.togglePlay();
            } else if (evt.keyCode === 32 && evt.shiftKey) {
                VideoPlayer.togglePlay();
                // Shift+Space or Tab: toggle play / pause.
            } else if (evt.keyCode === 9 && evt.shiftKey) {
                // Shift+Tab, go back 2 seconds
                VideoPlayer.seek(VideoPlayer.currentTime() - 2000);
            } else if (evt.keyCode === 188 && evt.shiftKey && evt.ctrlKey) {
                // Control+Shift+Comma, go back 4 seconds
                VideoPlayer.seek(VideoPlayer.currentTime() - 4000);
            } else if (evt.keyCode === 190 && evt.shiftKey && evt.ctrlKey) {
                // Control+Shift+Period, go forward 4 seconds
                VideoPlayer.seek(VideoPlayer.currentTime() + 4000);
            } else if (evt.target.type == 'textarea') {
                return;
            }
            // Shortcuts that should be disabled while editing a subtitle
            else if ((evt.keyCode == 40) && ($scope.timelineShown)) {
                $scope.$root.$emit("sync-next-start-time");
            } else if ((evt.keyCode == 38) && ($scope.timelineShown)) {
                $scope.$root.$emit("sync-next-end-time");
            } else if ((evt.keyCode == 13) && (!$scope.timelineShown)) {
                insertAndEditSubtitle();
            } else {
                return;
            }
            evt.preventDefault();
            evt.stopPropagation();
        };

        $scope.handleAppMouseMove = function(evt) {
            // Reset the lock timer.
            $scope.minutesIdle = 0;
        };

        $scope.handleAppMouseClick = function(evt) {
            // Reset the lock timer.
            $scope.minutesIdle = 0;
            $scope.$root.$emit("app-click");
        };
    });

    module.controller("AppControllerSubtitles", function($scope, $timeout,
                EditorData, SubtitleStorage, CurrentEditManager,
                SubtitleBackupStorage, SubtitleVersionManager) {
        var video = EditorData.video;
        $scope.currentEdit = new CurrentEditManager();
        $scope.workingSubtitles = new SubtitleVersionManager(
            video, SubtitleStorage);
        $scope.referenceSubtitles = new SubtitleVersionManager(
            video, SubtitleStorage);
        var editingVersion = EditorData.editingVersion;

        if(editingVersion.versionNumber) {
            $scope.workingSubtitles.getSubtitles(editingVersion.languageCode,
                    editingVersion.versionNumber);
        } else {
            $scope.workingSubtitles.initEmptySubtitles(
                    editingVersion.languageCode, EditorData.baseLanguage);
        }

        $scope.saveAutoBackup = function() {
            SubtitleBackupStorage.saveBackup(video.id,
                    $scope.workingSubtitles.language.code,
                    $scope.workingSubtitles.versionNumber,
                    $scope.workingSubtitles.subtitleList.toXMLString());
        }
        $scope.restoreAutoBackup = function() {
            var savedData = SubtitleBackupStorage.getBackup(video.id,
                    $scope.workingSubtitles.language.code,
                    editingVersion.versionNumber);
            $scope.workingSubtitles.subtitleList.loadXML(savedData);
            $scope.$root.$emit('work-done');
        }

        $scope.promptToRestoreAutoBackup = function() {
            $scope.dialogManager.openDialog({
                title: 'You have an unsaved backup of your subtitling work, do you want to restore it?',
                buttons: [
                    $scope.dialogManager.button('Restore', function() {
                        $scope.restoreAutoBackup();
                        $scope.dialogManager.close();
                    }),
                    $scope.dialogManager.button('Discard', function() {
                        SubtitleBackupStorage.clearBackup();
                        $scope.dialogManager.close();
                    })
                ]
            });
        }

        if(SubtitleBackupStorage.hasBackup(video.id,
                $scope.workingSubtitles.language.code,
                editingVersion.versionNumber)) {
            $timeout($scope.promptToRestoreAutoBackup);
        }


        $scope.saveSubtitles = function(markComplete) {
            return SubtitleStorage.saveSubtitles(
                    video.id,
                    $scope.workingSubtitles.language.code,
                    $scope.workingSubtitles.subtitleList.toXMLString(),
                    $scope.workingSubtitles.title,
                    $scope.workingSubtitles.description,
                    $scope.workingSubtitles.metadata,
                    markComplete);
        };
        function watchSubtitleAttributes(newValue, oldValue) {
            if(newValue != oldValue) {
                $scope.$root.$emit('work-done');
            }
        }
        $scope.$watch('workingSubtitles.title', watchSubtitleAttributes);
        $scope.$watch('workingSubtitles.description', watchSubtitleAttributes);
        $scope.$watch('workingSubtitles.metadata', watchSubtitleAttributes,
                true);
    });

}).call(this);
