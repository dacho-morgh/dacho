import * as migration_20260810_103455 from "./20260810_103455";
import * as migration_20260816_201404_add_phone_and_api_key_to_users from "./20260816_201404_add_phone_and_api_key_to_users";
import * as migration_20260823_201906_news_clone_of_posts from "./20260823_201906_news_clone_of_posts";
import * as migration_20260825_212808_add_roles_and_company_to_users from "./20260825_212808_add_roles_and_company_to_users";
import * as migration_20260831_213521_add_roles_and_services_fields from "./20260831_213521_add_roles_and_services_fields";
import * as migration_20260903_081500_backfill_applicant_usernames from "./20260903_081500_backfill_applicant_usernames";
import * as migration_20260907_081150_add_footer_customization_fields from "./20260907_081150_add_footer_customization_fields";
import * as migration_20260907_084600_add_social_links_icon from "./20260907_084600_add_social_links_icon";
import * as migration_20260913_130306_add_sliders from "./20260913_130306_add_sliders";
import * as migration_20260913_141229_add_slider_mobile_images from "./20260913_141229_add_slider_mobile_images";
import * as migration_20260913_213723_add_about_us_global from "./20260913_213723_add_about_us_global";
import * as migration_20260914_090000_add_complete_user_profile from "./20260914_090000_add_complete_user_profile";
import * as migration_20260920_161706_add_mag_cms from "./20260920_161706_add_mag_cms";
import * as migration_20260920_174206_mag_repeatable_sections from "./20260920_174206_mag_repeatable_sections";
import * as migration_20261004_104227_events_page_content from "./20261004_104227_events_page_content";
import * as migration_20261010_215200_add_logo_strip from "./20261010_215200_add_logo_strip";
import * as migration_20261017_210000_company_and_collapsed_roles from "./20261017_210000_company_and_collapsed_roles";
import * as migration_20261017_223000_rename_user_role_and_drop_roles_collection from "./20261017_223000_rename_user_role_and_drop_roles_collection";
import * as migration_20261018_090000_add_editor_role from "./20261018_090000_add_editor_role";
import * as migration_20261022_200000_add_service_ordering from "./20261022_200000_add_service_ordering";

import * as migration_20261024_200000_single_operational_role from "./20261024_200000_single_operational_role";
import * as migration_20261026_100000_add_company_activity_domain from "./20261026_100000_add_company_activity_domain";

export const migrations = [
  {
    up: migration_20260810_103455.up,
    down: migration_20260810_103455.down,
    name: "20260810_103455",
  },
  {
    up: migration_20260816_201404_add_phone_and_api_key_to_users.up,
    down: migration_20260816_201404_add_phone_and_api_key_to_users.down,
    name: "20260816_201404_add_phone_and_api_key_to_users",
  },
  {
    up: migration_20260823_201906_news_clone_of_posts.up,
    down: migration_20260823_201906_news_clone_of_posts.down,
    name: "20260823_201906_news_clone_of_posts",
  },
  {
    up: migration_20260825_212808_add_roles_and_company_to_users.up,
    down: migration_20260825_212808_add_roles_and_company_to_users.down,
    name: "20260825_212808_add_roles_and_company_to_users",
  },
  {
    up: migration_20260831_213521_add_roles_and_services_fields.up,
    down: migration_20260831_213521_add_roles_and_services_fields.down,
    name: "20260831_213521_add_roles_and_services_fields",
  },
  {
    up: migration_20260903_081500_backfill_applicant_usernames.up,
    down: migration_20260903_081500_backfill_applicant_usernames.down,
    name: "20260903_081500_backfill_applicant_usernames",
  },
  {
    up: migration_20260907_081150_add_footer_customization_fields.up,
    down: migration_20260907_081150_add_footer_customization_fields.down,
    name: "20260907_081150_add_footer_customization_fields",
  },
  {
    up: migration_20260907_084600_add_social_links_icon.up,
    down: migration_20260907_084600_add_social_links_icon.down,
    name: "20260907_084600_add_social_links_icon",
  },
  {
    up: migration_20260913_130306_add_sliders.up,
    down: migration_20260913_130306_add_sliders.down,
    name: "20260913_130306_add_sliders",
  },
  {
    up: migration_20260913_141229_add_slider_mobile_images.up,
    down: migration_20260913_141229_add_slider_mobile_images.down,
    name: "20260913_141229_add_slider_mobile_images",
  },
  {
    up: migration_20260913_213723_add_about_us_global.up,
    down: migration_20260913_213723_add_about_us_global.down,
    name: "20260913_213723_add_about_us_global",
  },
  {
    up: migration_20260914_090000_add_complete_user_profile.up,
    down: migration_20260914_090000_add_complete_user_profile.down,
    name: "20260914_090000_add_complete_user_profile",
  },
  {
    up: migration_20260920_161706_add_mag_cms.up,
    down: migration_20260920_161706_add_mag_cms.down,
    name: "20260920_161706_add_mag_cms",
  },
  {
    up: migration_20260920_174206_mag_repeatable_sections.up,
    down: migration_20260920_174206_mag_repeatable_sections.down,
    name: "20260920_174206_mag_repeatable_sections",
  },
  {
    up: migration_20261004_104227_events_page_content.up,
    down: migration_20261004_104227_events_page_content.down,
    name: "20261004_104227_events_page_content",
  },
  {
    up: migration_20261010_215200_add_logo_strip.up,
    down: migration_20261010_215200_add_logo_strip.down,
    name: "20261010_215200_add_logo_strip",
  },
  {
    up: migration_20261017_210000_company_and_collapsed_roles.up,
    down: migration_20261017_210000_company_and_collapsed_roles.down,
    name: "20261017_210000_company_and_collapsed_roles",
  },
  {
    up: migration_20261017_223000_rename_user_role_and_drop_roles_collection.up,
    down: migration_20261017_223000_rename_user_role_and_drop_roles_collection.down,
    name: "20261017_223000_rename_user_role_and_drop_roles_collection",
  },
  {
    up: migration_20261018_090000_add_editor_role.up,
    down: migration_20261018_090000_add_editor_role.down,
    name: "20261018_090000_add_editor_role",
  },
  {
    up: migration_20261022_200000_add_service_ordering.up,
    down: migration_20261022_200000_add_service_ordering.down,
    name: "20261022_200000_add_service_ordering",
  },
  { up: migration_20261024_200000_single_operational_role.up, down: migration_20261024_200000_single_operational_role.down, name: "20261024_200000_single_operational_role" },
  { up: migration_20261026_100000_add_company_activity_domain.up, down: migration_20261026_100000_add_company_activity_domain.down, name: "20261026_100000_add_company_activity_domain" },
];
