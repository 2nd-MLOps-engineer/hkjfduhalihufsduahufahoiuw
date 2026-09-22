from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("frontend", "0004_friendship_friendnote")]

    operations = [
        migrations.AddField(
            model_name="member",
            name="room_state",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="member",
            name="room_layout",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
