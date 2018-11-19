# -*- coding: utf-8 -*-
# Generated by Django 1.11.15 on 2018-11-16 15:58
from __future__ import unicode_literals

from django.db import migrations


forward_sql = """
UPDATE teams_setting
SET teams_setting.key=104
WHERE teams_setting.key=105 AND teams_setting.language_code != ''
"""

reverse_sql = """
UPDATE teams_setting
SET teams_setting.key=105
WHERE teams_setting.key=104 AND teams_setting.language_code != ''
"""


class Migration(migrations.Migration):

    dependencies = [
        ('teams', '0017_auto_20181116_1556'),
    ]

    operations = [
        migrations.RunSQL([forward_sql], reverse_sql=[reverse_sql]),
    ]
