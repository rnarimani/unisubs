# Amara, universalsubtitles.org
#
# Copyright (C) 2013 Participatory Culture Foundation
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see
# http://www.gnu.org/licenses/agpl-3.0.html.

import os
import logging
import time
from django.test import LiveServerTestCase
from django.test.testcases import (TestCase)
from selenium import webdriver
from django.conf import settings
from django.contrib.sites.models import Site
from urlparse import urlparse

class WebdriverTestCase(LiveServerTestCase, TestCase):

    # Subclasses can set this to False to reuse the same browser from test-case
    # to test-case.
    NEW_BROWSER_PER_TEST_CASE = True

    # Selenium browser to use in the tests
    browser = None

    @classmethod
    def setUpClass(cls):
        super(WebdriverTestCase, cls).setUpClass()
        cls.logger = logging.getLogger('test_steps')
        cls.logger.setLevel(logging.INFO)
        if not cls.NEW_BROWSER_PER_TEST_CASE:
            cls.create_browser()

    @classmethod
    def tearDownClass(cls):
        super(WebdriverTestCase, cls).tearDownClass()
        if not cls.NEW_BROWSER_PER_TEST_CASE:
            cls.destroy_browser()

    def setUp(self):
        super(WebdriverTestCase, self).setUp()
        #Set up logging to capture the test steps.
        self.logger.info('testcase: %s' % self.id())
        self.logger.info('description: %s' % self.shortDescription())
        

        #Match the Site port with the liveserver port so search redirects work.
        o = urlparse(self.live_server_url)
        Site.objects.get_current().domain = ('unisubs.example.com:%d' 
                                             % o.port)
        Site.objects.get_current().save()

        if self.NEW_BROWSER_PER_TEST_CASE:
            self.__class__.create_browser()
        
    def tearDown(self):
        if self.use_sauce:
            self.logger.info("Link to the job: https://saucelabs.com/jobs/%s" % self.browser.session_id)
            self.logger.info("SauceOnDemandSessionID={0} job-name={1}".format(
                               self.browser.session_id, self.shortDescription()))
        if self.NEW_BROWSER_PER_TEST_CASE:
            self.__class__.destroy_browser()

    @classmethod
    def create_browser(cls):
        #If running on sauce config values are from env vars 
        cls.use_sauce = os.environ.get('USE_SAUCE', False)
        if cls.use_sauce: 
            cls.sauce_key = os.environ.get('SAUCE_API_KEY')
            cls.sauce_user = os.environ.get('SAUCE_USER_NAME')
            test_browser = os.environ.get('SELENIUM_BROWSER', 'Chrome').upper()
            dc = getattr(webdriver.DesiredCapabilities, test_browser)

            dc['version'] = os.environ.get('SELENIUM_VERSION', '')
            dc['platform'] = os.environ.get('SELENIUM_PLATFORM', 'WINDOWS 2008')
            dc['name'] = cls.shortDescription()
            dc['tags'] = [os.environ.get('JOB_NAME', 'amara-local'),] 

            #Setup the remote browser capabilities
            cls.browser = webdriver.Remote(
                desired_capabilities=dc,
                command_executor=("http://{0}:{1}@ondemand.saucelabs.com:80/"
                                  "wd/hub".format(cls.sauce_user, cls.sauce_key)))

        #Otherwise just running locally - setup the browser to use.
        else:
            test_browser = os.environ.get('TEST_BROWSER', 'Firefox')
            cls.browser = getattr(webdriver, test_browser)()
        #Opening the create page as the starting point because it loads faster than the home page.
        cls.base_url = ('http://unisubs.example.com:%s/' %
                        cls.server_thread.port)
        cls.browser.get(cls.base_url + 'videos/create/')

    @classmethod
    def destroy_browser(cls):
        if cls.browser is not None:
            try:
                cls.browser.quit()
            except:
                # possibly should try to kill off the process so we don't
                # leave any around block ports.
                pass
            cls.browser = None
