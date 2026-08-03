INSERT INTO product_images(product_id,url,alt_text,position)
SELECT 5,'/images/iconic-05.jpg','Лавандовая льняная сорочка SARU',0
WHERE EXISTS (SELECT 1 FROM products WHERE id=5)
  AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id=5);

INSERT INTO product_images(product_id,url,alt_text,position)
SELECT 6,'/images/iconic-06.jpg','Тёмно-синяя хлопковая сорочка SARU',0
WHERE EXISTS (SELECT 1 FROM products WHERE id=6)
  AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id=6);
