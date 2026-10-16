# 3D-модель машины

Модель лежит в `app/public/3d/car.glb` (макет «Сканер» берёт её оттуда). Это «Car Concept» из Khronos glTF Sample Assets: https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept

© 2024 Darmstadt Graphics Group GmbH, модель и текстуры — Eric Chadwick. Лицензия Creative Commons Attribution 4.0 (CC BY 4.0): https://creativecommons.org/licenses/by/4.0/ — на сайте нужна подпись автора (в макете она в подвале). Исходник основан на модели «Free Concept Car 004» (Unity Fan, CC0).

Что изменено (скрипт в чате, `@gltf-transform`): убраны номерной знак и логотипы Khronos / 3D Commerce (их текстуры заменены однотонными, логотипы — товарные знаки и под CC BY не входят), убраны варианты окраски, салон и мелкие детали упрощены, текстуры сжаты в WebP до 1024 px, геометрия сжата meshopt. 11,8 МБ → 2,76 МБ.
